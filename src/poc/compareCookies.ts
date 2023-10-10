import axios from "axios";
import dotenv from "dotenv";
import { loginSessionHeaders } from "../config/sessionHeaders";
import { expectedHeaders } from "../config/expectedHeaders";
import { logger } from "../utils/logger";

dotenv.config();

// Interface for defining the structure of cookies
interface Cookies {
    [key: string]: string;
}

// Retrieve login URL from environment variables
const PAGE_URL = process.env.LOGIN_URL!;

// Function to fetch cookies from the given login URL
async function fetchCookies(): Promise<Cookies | void> {
    try {
        const response = await axios.get(PAGE_URL, {
            ...loginSessionHeaders,
            maxRedirects: 10,
            validateStatus: function (status: number): boolean {
                return status >= 200 && status < 400;
            },
        });

        // Extracting cookies from the response headers
        const setCookieHeaders: string[] | undefined = response.headers["set-cookie"];
        if (!setCookieHeaders) {
            logger.info("No cookies found.");
            return;
        }

        // Mapping and splitting headers to derive individual cookies
        const cookies = setCookieHeaders.map((header: string) => {
            return header.split(";")[0];
        });

        // Constructing a cookie object from the derived cookies
        const cookieObj: Cookies = {};
        cookies.forEach((cookieStr: string) => {
            const [key, value] = cookieStr.split("=");
            cookieObj[key.trim()] = value.trim();
        });

        // Logging any missing keys when comparing the fetched cookies to expected headers
        getMissingKeys(expectedHeaders, cookieObj);
        return cookieObj;
    } catch (error: any) {
        logger.error("Failed to fetch cookies: " + error.message);
    }
}

// Function to determine and log keys that are present in object A but missing in object B
function getMissingKeys(A: object, B: object): void {
    const missingKeys = Object.keys(A).filter((key: string) => !(key in B));
    logger.info("Missing Keys: ", missingKeys);
}

// Initial call to fetch and process cookies from the given login URL
fetchCookies();
