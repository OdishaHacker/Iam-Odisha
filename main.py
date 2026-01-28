from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
import aiohttp, os

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
BASE_URL = os.getenv("BASE_URL")

app = FastAPI()

@app.get("/", response_class=HTMLResponse)
async def home():
    return """
<!DOCTYPE html>
<html>
<body style="background:#020617;color:#fff;font-family:sans-serif">
<h2>Telegram Storage</h2>
<input type="file" id="f">
<button onclick="u()">Upload</button>
<progress id="p" value="0" max="100"></progress>
<p id="s"></p>

<script>
function u(){
 let f=document.getElementById("f").files[0];
 let x=new XMLHttpRequest();
 let d=new FormData();
 d.append("file",f);
 let start=Date.now();

 x.upload.onprogress=e=>{
   let percent=(e.loaded/e.total*100).toFixed(1);
   document.getElementById("p").value=percent;
   let speed=(e.loaded/1024/1024/((Date.now()-start)/1000)).toFixed(2);
   document.getElementById("s").innerText=percent+"% | "+speed+" MB/s";
 }
 x.onload=()=>{document.body.innerHTML+=x.responseText;}
 x.open("POST","/upload");
 x.send(d);
}
</script>
</body>
</html>
"""

@app.post("/upload", response_class=HTMLResponse)
async def upload(file: UploadFile = File(...)):
    async with aiohttp.ClientSession() as s:
        data = aiohttp.FormData()
        data.add_field("chat_id", CHANNEL_ID)
        data.add_field(
            "document",
            file.file,
            filename=file.filename,
            content_type="application/octet-stream"
        )

        async with s.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument",
            data=data
        ) as r:
            res = await r.json()

    file_id = res["result"]["document"]["file_id"]
    name = res["result"]["document"]["file_name"]
    link = f"{BASE_URL}/download/{file_id}?name={name}"

    return f"<p>✅ Upload Success</p><a href='{link}' target='_blank'>{link}</a>"

@app.get("/download/{file_id}")
async def download(file_id: str):
    async with aiohttp.ClientSession() as s:
        async with s.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getFile",
            params={"file_id": file_id}
        ) as r:
            j = await r.json()

    path = j["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{path}"
    return RedirectResponse(url)
