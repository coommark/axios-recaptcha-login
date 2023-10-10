import { EventEmitter } from "node:events";
import dotenv from "dotenv";
import { loginSessionHeaders } from "./config/sessionHeaders";
import axios, { AxiosResponse } from "axios";
import { extractCookies } from "./utils/cookiesExtractor";
import { logger } from "./utils/logger";

dotenv.config();

// Class representing the login manager, responsible for automating the login process.
export default class LoginManager extends EventEmitter {
    // Define static constants using environment variables
    private static readonly LOGIN_URL = process.env.LOGIN_URL ?? "";
    private static readonly LOGIN_MAX_RETRIES = parseInt(process.env.LOGIN_MAX_RETRIES ?? "3");
    private static readonly EMAIL = process.env.EMAIL ?? "";
    private static readonly PASSWORD = process.env.PASSWORD ?? "";

    // Helper method to calculate delay between login retries based on attempt number
    private static retryDelay(attempt: number): number {
        return 1000 * attempt * attempt;
    }

    constructor() {
        super();
    }

    // Private method to send a login request with the provided recaptcha token
    private async sendLoginRequest(recaptchaToken: string): Promise<AxiosResponse> {
        // Extract required cookies for login
        const cookies = await extractCookies(LoginManager.LOGIN_URL);

        // Define the login form payload
        const formData = {
            form_type: "customer_login",
            utf8: "✓",
            "customer[email]": LoginManager.EMAIL,
            "customer[password]": LoginManager.PASSWORD,
            return_url: "/account",
            "recaptcha-v3-token": recaptchaToken,
        };

        // Construct the headers for the login request
        const headers = {
            ...loginSessionHeaders,
            Cookie: cookies,
        };

        // Send a POST request to login
        return axios.post(LoginManager.LOGIN_URL, new URLSearchParams(formData).toString(), {
            headers,
            maxRedirects: 10,
            validateStatus: (status: number) => status >= 200 && status < 303,
        });
    }

    // Private method to handle the response of the login request
    private async handleLoginResponse(response: AxiosResponse): Promise<void> {
        // Check if the login was successful by checking the response content
        if (response.status === 200 && response.data.includes('<h3 class="mar-bot">Account Information</h3>')) {
            logger.info("Logged in successfully!");
            this.emit("login_success", response);
        } else {
            logger.error("Failed to log in.");
            this.emit("login_failed", response.status);
        }
    }

    // Public method to execute the login flow
    async login(recaptchaToken: string): Promise<void> {
        let retries = 0;
        // Attempt login until max retries is reached
        while (retries < LoginManager.LOGIN_MAX_RETRIES) {
            try {
                const response = await this.sendLoginRequest(recaptchaToken);
                await this.handleLoginResponse(response);
                break;
            } catch (error: any) {
                retries++;
                logger.error(`Login attempt ${retries} resulted in an error: ${error.message}.`);

                // If not exceeded max retries, wait and retry the login
                if (retries < LoginManager.LOGIN_MAX_RETRIES) {
                    const delay = LoginManager.retryDelay(retries);
                    logger.info(`Waiting for ${delay}ms before retrying...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    logger.error("Max retries reached. Login failed.");
                }
            }
        }
    }
}
