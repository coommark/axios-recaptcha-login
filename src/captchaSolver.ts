import { EventEmitter } from "node:events";
import axios from "axios";
import dotenv from "dotenv";
import winston from "winston";
import { captchaSessionHeaders } from "./config/sessionHeaders";
import { logger } from "./utils/logger";
dotenv.config();

interface Payload {
    clientKey: string;
    task?: {
        type: string;
        websiteURL: string;
        websiteKey: string;
        pageAction?: string;
        proxy?: string;
    };
    taskId?: string;
}

interface ResponseData {
    status?: string;
    solution?: {
        gRecaptchaResponse: string;
    };
}

export default class CaptchaSolver extends EventEmitter {
    private static readonly PAGE_URL = process.env.LOGIN_URL!;
    private static readonly PAGE_KEY = process.env.PAGE_KEY!;
    private static readonly PAGE_ACTION = process.env.PAGE_ACTION!;
    private static readonly CAPSOLVER_KEY = process.env.CAPSOLVER_KEY!;
    private static readonly MAX_RETRIES = 5;

    constructor() {
        super();
    }

    private async createTask(): Promise<string> {
        logger.info("Creating CAPTCHA task...");
        try {
            const apiUrl: string = "https://api.capsolver.com/createTask";
            const payload: Payload = {
                clientKey: CaptchaSolver.CAPSOLVER_KEY,
                task: {
                    type: "ReCaptchaV3TaskProxyLess",
                    websiteURL: CaptchaSolver.PAGE_URL,
                    websiteKey: CaptchaSolver.PAGE_KEY,
                    pageAction: CaptchaSolver.PAGE_ACTION,
                },
            };
            const headers = { "Content-Type": "application/json" };
            const response = await axios.post(apiUrl, payload, { headers });
            logger.info(`Task ID: ${response.data.taskId}`);
            return response.data.taskId;
        } catch (error) {
            logger.error("Error creating CAPTCHA task:", error);
            throw error;
        }
    }

    private async getTaskResult(taskId: string): Promise<{ gRecaptchaResponse: string }> {
        logger.info("Retrieving CAPTCHA result...");
        try {
            const apiUrl: string = "https://api.capsolver.com/getTaskResult";
            const payload: Payload = {
                clientKey: CaptchaSolver.CAPSOLVER_KEY,
                taskId: taskId,
            };
            const headers = { "Content-Type": "application/json" };
            let result: ResponseData;
            let retries = 0;
            do {
                const response = await axios.post(apiUrl, payload, { headers });
                result = response.data;
                if (result.status === "ready") {
                    return result.solution!;
                }
                await new Promise((resolve) => setTimeout(resolve, 5000));
                retries++;
            } while (retries < CaptchaSolver.MAX_RETRIES);
            throw new Error("Max retries reached while fetching captcha solution.");
        } catch (error) {
            logger.error("Error getting CAPTCHA result:", error);
            throw error;
        }
    }

    async solve(): Promise<void> {
        const headers = {
            "Content-Type": "application/json",
            ...captchaSessionHeaders,
        };
        try {
            const taskId: string = await this.createTask();
            const solution = await this.getTaskResult(taskId);
            const token: string = solution.gRecaptchaResponse;

            const res = await axios.post("https://antcpt.com/score_detector/verify.php", { "g-recaptcha-response": token }, { headers });
            logger.info(`Score: ${res.data.score}`);
            this.emit("got_captcha", token);
        } catch (error) {
            logger.error("Error in captcha solving process:", error);
            this.emit("captcha_failed", error);
        }
    }
}
