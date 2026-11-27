import { signOut } from "next-auth/react";
import { forgetPushInThisBrowser } from "./webPush";
import { layTilesToRest } from "@/components/stoneScene/atRest";

// Every sign-out a person asks for, so this browser also stops showing their notifications,
// and the screen turns its tiles face down while that happens.
export const signOutOfMosaic = async (options) => {
    await Promise.all([forgetPushInThisBrowser(), layTilesToRest()]);
    return signOut(options);
};
