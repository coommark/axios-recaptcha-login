import CaptchaSolver from "./captchaSolver";
import LoginManager from "./loginManager";
import { logger } from "./utils/logger";

const captchaSolver = new CaptchaSolver();
const loginManager = new LoginManager();

captchaSolver.solve();

loginManager.on("login_failed", (error) => {
    logger.error("Login attemp failed, exiting proces...");
});

captchaSolver.on("captcha_failed", (token) => {
    loginManager.login(token);
});

captchaSolver.on("got_captcha", (token) => {
    loginManager.login(token);
});

loginManager.on("login_success", (payload) => {
    // Scrapping may now be initiated at this point
    logger.info("Login procedure completed...");
});
