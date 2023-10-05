import CaptchaSolver from "./captchaSolver";
import LoginManager from "./loginManager";
import { logger } from "./utils/logger";

// Instantiate the captcha solver and login manager
const captchaSolver = new CaptchaSolver();
const loginManager = new LoginManager();

// Initiate the captcha solving process
captchaSolver.solve();

// Respond to events emitted by the CaptchaSolver and LoginManager
loginManager.on("login_failed", (error: Error) => {
    logger.error(`Login attempt failed due to: ${error.message}, exiting process...`);
});

captchaSolver.on("captcha_failed", (error: Error) => {
    logger.error(`Captcha solving failed due to: ${error.message}`);
});

captchaSolver.on("got_captcha", (token: string) => {
    logger.info(`Received captcha token: ${token}`);
    loginManager.login(token);
});

loginManager.on("login_success", (payload: string) => {
    logger.info("Login procedure completed...");
    // Scrapping or any other subsequent operations may now be initiated
});
