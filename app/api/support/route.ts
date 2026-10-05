import {configured,insert,rateLimited} from "../db";
import {supportFormHandler} from "../../../lib/support/form.ts";
// Existing public response shape. Bounded form storage never invokes a mailbox or assistant.
export const POST=supportFormHandler({configured,limited:rateLimited,insert});
