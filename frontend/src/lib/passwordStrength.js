import { MIN_PASSWORD_LENGTH, passwordProblem } from "../../../shared/rules/passwordPolicy.js";

export { MIN_PASSWORD_LENGTH, passwordProblem };

// Four bars: acceptable, longer, then a number and a symbol, then long with all of them. Nothing below the
// policy scores above one bar, so the meter never praises a password the form would refuse.
export function passwordStrength(password, { username = "" } = {}) {
    if (!password) return { score: 0, hint: `At least ${MIN_PASSWORD_LENGTH} characters, with a number or symbol` };
    if (password.length < MIN_PASSWORD_LENGTH) return { score: 1, hint: `${MIN_PASSWORD_LENGTH - password.length} more to go` };

    const problem = passwordProblem(password, { username });
    if (problem) return { score: 1, hint: problem };

    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^\p{L}\p{N}]/u.test(password);
    const score = 2 + (password.length >= 12 ? 1 : 0) + (hasDigit && hasSymbol ? 1 : 0);
    const hint = score === 4 ? "Strong." : password.length < 12 ? "Good. A longer one is stronger." : "Good. Add both a number and a symbol to make it strong.";
    return { score, hint };
}
