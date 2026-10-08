async function check(){
    const url = process.env.SUPABASE_URL;
    const key= process.env.SUPABASE_SECRET_KEY;
    if (!url || !key || !key.startsWith("sb_secret_")){
        throw new Error("Set the Project URL and Actual secret key in .env");
    }
    const response = await fetch(url + "/rest/v1/",{
        headers: {apikey:key},
        signal:AbortSignal.timeout(10000)
});
if(!response.ok){
    throw new Error("Supabase returned HTTP"+response.status);

}
console.log("Supabase connection successful");
}
check().catch(error=>{
    console.error(error.message);
    process.exitCode=1;
});