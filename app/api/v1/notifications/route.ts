import {supabaseVerifier,UUID} from "../../../../lib/account.ts";
import {notificationHandler,supabasePushRepository} from "../../../../lib/notifications.ts";
export const runtime="nodejs";
async function handle(request:Request){
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,project=process.env.WD_EXPO_PROJECT_ID,environment=process.env.WD_PUSH_ENVIRONMENT;
 if(process.env.WD_NOTIFICATIONS_API_ENABLED!=="true"||!url||!key||!project||!UUID.test(project)||!["production","development"].includes(environment??""))return Response.json({error:"notifications_not_configured"},{status:503,headers:{"Cache-Control":"no-store"}});
 try{return await notificationHandler({verify:supabaseVerifier(url,key),repository:supabasePushRepository(url,key),config:{projectId:project,environment:environment as "production"|"development"}})(request);}
 catch{return Response.json({error:"notifications_not_configured"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
export const POST=handle;export const DELETE=handle;
