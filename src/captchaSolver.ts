import { EventEmitter } from "node:events";
import axios from "axios";
import dotenv from "dotenv";
import { captchaSessionHeaders } from "./config/sessionHeaders";
import { logger } from "./utils/logger";
dotenv.config();

// Define interface structures for request payloads and responses
interface Payload {
    clientKey: string;
    task?: {
        type: string;
        websiteURL: string;
        websiteKey: string;
        pageAction?: string;
    };
    taskId?: string;
}

interface ResponseData {
    status?: string;
    solution?: {
        gRecaptchaResponse: string;
    };
}

// CaptchaSolver class extends EventEmitter for custom event-driven operations related to CAPTCHA solving
export default class CaptchaSolver extends EventEmitter {
    // Static constants read from environment variables
    private static readonly PAGE_URL = process.env.LOGIN_URL!;
    private static readonly PAGE_KEY = process.env.PAGE_KEY!;
    private static readonly PAGE_ACTION = process.env.PAGE_ACTION!;
    private static readonly CAPSOLVER_KEY = process.env.CAPSOLVER_KEY!;
    private static readonly CREATE_TASK_URL = process.env.CREATE_TASK_URL!;
    private static readonly GET_TASK_URL = process.env.GET_TASK_URL!;
    private static readonly MAX_RETRIES = 5;

    constructor() {
        super();
    }

    // Private method to create a CAPTCHA solving task using CAPSOLVER service
    private async createTask(): Promise<string> {
        logger.info("Creating CAPTCHA task...");
        try {
            const apiUrl: string = CaptchaSolver.CREATE_TASK_URL;
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

    // Private method to poll for and retrieve the result of the CAPTCHA solving task
    private async getTaskResult(taskId: string): Promise<{ gRecaptchaResponse: string }> {
        logger.info("Retrieving CAPTCHA result...");
        try {
            const apiUrl: string = CaptchaSolver.GET_TASK_URL;
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
                await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5 seconds
                retries++;
            } while (retries < CaptchaSolver.MAX_RETRIES);
            throw new Error("Max retries reached while fetching captcha solution.");
        } catch (error) {
            logger.error("Error getting CAPTCHA result:", error);
            throw error;
        }
    }

    // Public method to start the CAPTCHA solving process and emit the result or error events
    async solve(): Promise<void> {
        const headers = {
            "Content-Type": "application/json",
            ...captchaSessionHeaders,
        };
        try {
            const taskId: string = await this.createTask();
            const solution = await this.getTaskResult(taskId);
            const token: string = solution.gRecaptchaResponse;

            this.emit("got_captcha", token); // Emit successful captcha result
        } catch (error) {
            logger.error("Error in captcha solving process:", error);
            this.emit("captcha_failed", error); // Emit an event for CAPTCHA process failure
        }
    }
}
