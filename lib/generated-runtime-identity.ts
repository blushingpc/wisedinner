// Same UUID syntax as the account module, without importing account/auth code
// into the no-account native planner. This is validation, not scope authority.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
