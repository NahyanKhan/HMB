async function db(path, method = "GET", body){
    const response = await fetch(
        process.env.SUPABASE_URL + "/rest/v1/" + path,
        {
            method,
            headers:{
                apikey: process.env.SUPABASE_SECRET_KEY,
                "Content-Type": "application/json",
                Prefer: "return=representation,resolution=merge-duplicates"
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(10000)
        }
    );
const text = await response.text();
let data;
try{
    data = text ? JSON.parse(text) : null;
} catch {
    throw new Error("Unexpected database response");

}
if (!response.ok){
    const error = new Error(
        data?.code ==="P0001"
        ? data.message
        : "Database request failed"
    );
    error.status = data?.code ==="P0001" ? 409 : 503;
    throw error;
}
return data;
}
module.exports = db;