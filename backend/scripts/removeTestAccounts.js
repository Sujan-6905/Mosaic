// Lists accounts made by the end-to-end suite and removes them with --confirm. Accounts
// younger than an hour are skipped so a running suite keeps its own.
import "dotenv/config";
import { getDefaultInstance } from "ottoman";
import "../src/db/connection.js";
import { removeAccount } from "../src/services/accountRemoval.js";
import User from "../src/models/userSchema.js";

const MIN_AGE_MS = 60 * 60 * 1000;
// Enough to finish thousands of accounts in minutes without crowding a free-tier cluster.
const CONCURRENT_REMOVALS = 8;
// randomUsername in frontend/e2e/support/backend.js: a prefix, Date.now(), then up to four base-36 characters.
const E2E_USERNAME = /^[a-z0-9_]{2,12}1\d{12}[a-z0-9]{0,4}$/;
const AUDIT_USERNAME = /^audit_/;

const isTestUsername = (username) => E2E_USERNAME.test(username) || AUDIT_USERNAME.test(username);

const confirmed = process.argv.includes("--confirm");
const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString();

const { rows } = await getDefaultInstance().query(
    `SELECT META(u).id AS id, u.username, u.createdAt FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`users\` AS u
     WHERE u.createdAt < $cutoff`,
    { parameters: { cutoff } },
);
const targets = rows.filter((row) => typeof row.username === "string" && isTestUsername(row.username));

console.log(`${targets.length} test accounts older than an hour, of ${rows.length} accounts checked`);
targets.forEach((row) => console.log(`  ${row.username}  ${row.createdAt}`));

if (!confirmed) {
    console.log("Dry run. Run again with --confirm to remove them.");
    process.exit(0);
}

let boards = 0;
let failed = 0;
let done = 0;
const queue = [...targets];
const removeNext = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
        try {
            boards += await removeAccount(await User.findById(row.id));
        } catch (error) {
            failed += 1;
            console.error(`could not remove ${row.username}: ${error.message}`);
        }
        done += 1;
        if (done % 100 === 0) console.log(`${done} of ${targets.length}`);
    }
};
await Promise.all(Array.from({ length: CONCURRENT_REMOVALS }, removeNext));
console.log(`Removed ${targets.length - failed} accounts and ${boards} boards; ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
