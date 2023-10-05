import { EventEmitter } from "node:events";
import dotenv from "dotenv";
import { loginSessionHeaders } from "./config/sessionHeaders";
import axios, { AxiosResponse } from "axios";
import { extractCookies } from "./utils/cookiesExtractor";
import { logger } from "./utils/logger";

dotenv.config();

// Utilize EventEmitter for an event-driven architecture, enabling multiple subscribers and enhancing scalability.
export default class LoginManager extends EventEmitter {
    private static readonly LOGIN_URL = process.env.LOGIN_URL ?? "";
    private static readonly LOGIN_MAX_RETRIES = parseInt(process.env.LOGIN_MAX_RETRIES ?? "3");
    private static readonly EMAIL = process.env.EMAIL ?? "";
    private static readonly PASSWORD = process.env.PASSWORD ?? "";

    private static retryDelay(attempt: number): number {
        return 1000 * attempt * attempt;
    }

    constructor() {
        super();
    }

    private async sendLoginRequest(recaptchaToken: string): Promise<AxiosResponse> {
        const cookies = await extractCookies(LoginManager.LOGIN_URL);
        const formData = {
            form_type: "customer_login",
            utf8: "✓",
            "customer[email]": LoginManager.EMAIL,
            "customer[password]": LoginManager.PASSWORD,
            return_url: "/account",
            "recaptcha-v3-token": recaptchaToken,
        };

        const headers = {
            ...loginSessionHeaders,
            Cookie: cookies,
        };

        return axios.post(LoginManager.LOGIN_URL, new URLSearchParams(formData).toString(), {
            headers,
            maxRedirects: 10,
            validateStatus: (status: number) => status >= 200 && status < 303,
        });
    }

    private async handleLoginResponse(response: AxiosResponse): Promise<void> {
        if (response.status === 200 && response.data.includes('<h3 class="mar-bot">Account Information</h3>')) {
            logger.info("Logged in successfully!");
            this.emit("login_success", response);
        } else {
            logger.error("Failed to log in.");
            this.emit("login_failed", response.status);
        }
    }

    // Public method to be called after class is instantiated
    async login(recaptchaToken: string): Promise<void> {
        let retries = 0;
        while (retries < LoginManager.LOGIN_MAX_RETRIES) {
            try {
                const response = await this.sendLoginRequest(recaptchaToken);
                await this.handleLoginResponse(response);
                break;
            } catch (error: any) {
                retries++;
                console.error(`Login attempt ${retries} resulted in an error: ${error.message}.`);

                if (retries < LoginManager.LOGIN_MAX_RETRIES) {
                    const delay = LoginManager.retryDelay(retries);
                    console.log(`Waiting for ${delay}ms before retrying...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    console.error("Max retries reached. Login failed.");
                }
            }
        }
    }
}
