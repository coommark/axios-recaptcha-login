import axios, { AxiosResponse } from "axios";
import { logger } from "../utils/logger";

export const extractCookies = async (loginUrl: string): Promise<string> => {
    const loginPage: AxiosResponse = await axios.get(loginUrl);
    const setCookieHeader: string[] | undefined = loginPage.headers["set-cookie"];

    if (!setCookieHeader) {
        logger.error("No cookies found.");
        throw new Error("No cookies found.");
    }

    logger.info("Cookies extracted successfully.");

    return setCookieHeader.map((cookie: string) => cookie.split(";")[0]).join("; ");
};
