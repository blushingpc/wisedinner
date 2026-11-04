const port=Number(process.env.PORT??3000);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid_PORT');
const {startServer}=await import('next/dist/server/lib/start-server.js');
await startServer({dir:process.cwd(),isDev:false,hostname:'0.0.0.0',port,allowRetry:false});
