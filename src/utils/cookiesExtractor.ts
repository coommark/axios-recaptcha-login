import axios, { AxiosResponse } from "axios";
import { logger } from "../utils/logger";
import { loginSessionHeaders } from "../config/sessionHeaders";

// This function extracts cookies from the login page of a website
export const extractCookies = async (loginUrl: string): Promise<string> => {
    // Fetch the login page with provided session headers and configurations
    const loginPage: AxiosResponse = await axios.get(loginUrl, {
        ...loginSessionHeaders,
        maxRedirects: 10,
        validateStatus: (status: number) => status >= 200 && status < 303,
    });

    // Extract the "set-cookie" headers from the response
    const setCookieHeader: string[] | undefined = loginPage.headers["set-cookie"];

    // Check if the set-cookie header exists; if not, log an error and throw an exception
    if (!setCookieHeader) {
        logger.error("No cookies found.");
        throw new Error("No cookies found.");
    }

    logger.info("Cookies extracted successfully.");

    // Return the extracted cookies as a single semi-colon-separated string
    return setCookieHeader.map((cookie: string) => cookie.split(";")[0]).join("; ");
};
