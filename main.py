from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse
import os, aiohttp

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
BASE_URL = os.getenv("BASE_URL")

app = FastAPI()

@app.get("/", response_class=HTMLResponse)
async def home():
    return f"""
<!DOCTYPE html>
<html>
<body style="background:#020617;color:#fff;font-family:sans-serif">
<h2>Telegram Storage</h2>

<input type="file" id="f">
<button onclick="u()">Upload</button>
<br><br>
<progress id="p" value="0" max="100" style="width:100%"></progress>
<p id="s"></p>

<script>
function u() {{
 let f=document.getElementById("f").files[0];
 if(!f) return alert("Select file");

 let url="https://api.telegram.org/bot{BOT_TOKEN}/sendDocument";

 let fd=new FormData();
 fd.append("chat_id","{CHANNEL_ID}");
 fd.append("document",f);

 let xhr=new XMLHttpRequest();
 let start=Date.now();

 xhr.upload.onprogress=function(e) {{
   if(e.lengthComputable) {{
     let percent=(e.loaded/e.total*100).toFixed(1);
     let speed=(e.loaded/1024/1024/((Date.now()-start)/1000)).toFixed(2);
     document.getElementById("p").value=percent;
     document.getElementById("s").innerText=
       percent+"% | "+speed+" MB/s";
   }}
 }};

 xhr.onload=function() {{
   let r=JSON.parse(xhr.responseText);
   let id=r.result.document.file_id;
   let name=r.result.document.file_name;
   let link="{BASE_URL}/download/"+id+"?name="+encodeURIComponent(name);
   document.body.innerHTML +=
     "<p>✅ Upload Success</p><a href='"+link+"'>"+link+"</a>";
 }};

 xhr.onerror=function() {{
   alert("Upload failed");
 }};

 xhr.open("POST",url);
 xhr.send(fd);
}}
</script>
</body>
</html>
"""

@app.get("/download/{file_id}")
async def download(file_id: str):
    async with aiohttp.ClientSession() as s:
        async with s.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getFile",
            params={{"file_id": file_id}}
        ) as r:
            j = await r.json()

    path = j["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{path}"
    return RedirectResponse(url)   let percent=(e.loaded/e.total*100).toFixed(1);
   let speed=(e.loaded/1024/1024/((Date.now()-start)/1000)).toFixed(2);
   document.getElementById("p").value=percent;
   document.getElementById("s").innerText=percent+"% | "+speed+" MB/s";
 };

 xhr.onload=()=>{
   let r=JSON.parse(xhr.responseText);
   let id=r.result.document.file_id;
   let name=r.result.document.file_name;
   let link="{BASE_URL}/download/"+id+"?name="+encodeURIComponent(name);
   document.body.innerHTML+="<p>✅ Upload Success</p><a href='"+link+"'>"+link+"</a>";
 };

 xhr.open("POST",url);
 xhr.send(fd);
}
</script>
</body>
</html>
"""

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
