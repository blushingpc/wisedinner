// Stage first. Legacy --local wrote public data; it is no longer a dry-run path.
// No publication, seed/upsert, storage or Git writer is bound to this CLI.
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {stagedPipeline} from "./staged-pipeline.ts";
export async function main(args=process.argv.slice(2)){
 const output=args.find(a=>a.startsWith("--stage="))?.slice(8);
 if(!output || args.some(a=>!a.startsWith("--stage=")))throw new Error("Use --stage=data/pipeline/staging/<unique-id>. Old pipeline/local publication is disabled until separately authorized staged rollout.");
 const manifest=await stagedPipeline(output);
 console.log(JSON.stringify({status:manifest.status,output,reason:manifest.reason,price_accepted:manifest.price_accepted,price_rows:manifest.price_rows}));
 if(manifest.status!=="accepted")process.exitCode=1;
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.error("Pipeline refused: explicit isolated stage path required; no external writer ran.");process.exitCode=1;});
