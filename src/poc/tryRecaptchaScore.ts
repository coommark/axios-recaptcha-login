const axios = require("axios");
import dotenv from "dotenv";
import { captchaSessionHeaders } from "../config/sessionHeaders";
import { logger } from "../utils/logger";

dotenv.config();

// Declare and initialize constants from environment variables
const PAGE_URL = process.env.TEST_URL!;
const PAGE_KEY = process.env.TEST_URL_PAGE_KEY!;
const PAGE_ACTION = process.env.TEST_URL_PAGE_ACTION!;
const CAPSOLVER_KEY = process.env.CAPSOLVER_KEY!;
const CREATE_TASK_URL = process.env.CREATE_TASK_URL!;
const GET_TASK_URL = process.env.GET_TASK_URL!;
const VERIFY_SCORE_URL = process.env.VERIFY_SCORE_URL!;

// Function to create a CAPTCHA task using capsolver API
async function createTask(url: string, key: string, pageAction: string) {
    try {
        const apiUrl = CREATE_TASK_URL;
        const payload = {
            clientKey: CAPSOLVER_KEY,
            task: {
                type: "ReCaptchaV3TaskProxyLess",
                websiteURL: url,
                websiteKey: key,
                pageAction: pageAction,
            },
        };
        const headers = {
            "Content-Type": "application/json",
        };
        const response = await axios.post(apiUrl, payload, { headers });
        return response.data.taskId;
    } catch (error) {
        logger.error("Error creating CAPTCHA task: ", error);
        throw error;
    }
}

// Function to retrieve the result of the CAPTCHA task
async function getTaskResult(taskId: string) {
    try {
        const apiUrl = GET_TASK_URL;
        const payload = {
            clientKey: CAPSOLVER_KEY,
            taskId: taskId,
        };
        const headers = {
            "Content-Type": "application/json",
        };
        let result;
        do {
            const response = await axios.post(apiUrl, payload, { headers });
            result = response.data;
            if (result.status === "ready") {
                return result.solution;
            }
            await new Promise((resolve) => setTimeout(resolve, 5000)); // wait 5 seconds before retrying
        } while (true);
    } catch (error) {
        logger.error("Error getting CAPTCHA result: ", error);
        throw error;
    }
}

// Main function to create a CAPTCHA task, retrieve its result, and then verify the result
async function main() {
    const headers = captchaSessionHeaders;
    logger.info("Creating CAPTCHA task...");
    const taskId = await createTask(PAGE_URL, PAGE_KEY, PAGE_ACTION);
    logger.info(`Task ID: ${taskId}`);

    logger.info("Retrieving CAPTCHA result...");
    const solution = await getTaskResult(taskId);
    const token = solution.gRecaptchaResponse;
    logger.info(`Token Solution ${token}`);

    const res = await axios.post(VERIFY_SCORE_URL, { "g-recaptcha-response": token }, { headers });
    const response = res.data;

    logger.info(`Score: ${response.score}`);
}

// Call main function and handle any errors using the logger
main().catch((err) => {
    logger.error(err);
});
