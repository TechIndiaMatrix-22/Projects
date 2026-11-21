const $=id=>document.getElementById(id);
let latestStatus=null;
let selectedCamera="cam1";
const fmtBytes=n=>{if(n==null)return "—";const u=["B","KB","MB","GB","TB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return n.toFixed(1)+" "+u[i]};
async function api(url,options={}){const r=await fetch(url,{...options,credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})}});const d=await r.json().catch(()=>({detail:"Server response error"}));if(!r.ok)throw new Error(d.detail||`HTTP ${r.status}`);return d}
function setDisabled(disabled){
    document.querySelectorAll('[data-action="capture"],[data-action="record-start"]').forEach(b=>{
        b.disabled=disabled;
        b.title=disabled?"Turn Camera ON and mount the SD card first":"";
    });
    const stop=$('[data-action="record-stop"]');
    if(stop)stop.disabled=disabled;
    if($("reload-media"))$("reload-media").disabled=disabled;
}
function renderStatus(d){
latestStatus=d;

const s=d.storage||{};
const present=!!s.mounted;
const on=!!d.camera_on;

$("sd-status").textContent=present?"● SD CARD CONNECTED":"● SD CARD MISSING";
$("sd-status").className="status "+(present?"good":"bad");
$("sd-alert").classList.toggle("hidden",present);

$("storage-detail").textContent=present?"CONNECTED":(s.message||"MISSING");
$("free-detail").textContent=present?fmtBytes(s.free):"Unavailable";

$("camera-detail").textContent=on?"MEDIAMTX RUNNING":(d.camera_status||"CAMERA OFF");
$("cam-status").textContent=on?"● CAMERA ON / WEBRTC READY":"● CAMERA OFF";
$("cam-status").className="status "+(on?"good":"bad");

$("recording-detail").textContent=d.recording?"RECORDING":"STOPPED";

/* Synchronize the camera grid with the real backend state */
const grid=$("camera-grid");

if(grid){
    grid.classList.toggle("camera-disabled",!on);

    grid.querySelectorAll(".camera-tile").forEach(tile=>{
        tile.classList.toggle("disabled-camera",!on);
    });

    const cam1=$("cam1-tile");
    const cam1Player=$("webrtc-player");

    if(cam1){
        cam1.classList.toggle("offline",!on);
        cam1.classList.toggle("online",on);
    }

    if(cam1Player){
        cam1Player.style.display=on?"block":"none";
    }

    /* Synchronize Cam2 with the backend camera state */
    const cam2 = $("cam2-tile");
    const cam2Player = $("webrtc-player-cam2");

    if (cam2) {
    	if (!cam2.dataset.connectionChecked) cam2.classList.add("offline");
    	if (!cam2.dataset.connectionChecked) cam2.classList.remove("online");
    }

    if (cam2Player) {
    	if (!cam2.dataset.connectionChecked) cam2Player.style.display = "none";
    }
}

const offImage=$("camera-off-image");
const player=$("webrtc-player");

if(offImage&&player){
    offImage.style.display=on?"none":"block";
    player.style.display=on?"block":"none";
}

$("storage-page-status").textContent=present
    ?`SD CONNECTED · ${s.source||""} · ${s.filesystem||""} · ${fmtBytes(s.free)} free / ${fmtBytes(s.total)} (${s.percent}% used)`
    :`SD CARD MISSING · ${s.message||"Insert and mount card."}`;

$("storage-progress").style.width=present?`${s.percent||0}%`:"0%";

$("camera-on").disabled=on;
$("camera-off").disabled=!on;

setDisabled(!on);

document.querySelectorAll('[data-action="record-start"]').forEach(b=>{
    b.disabled=!on||!!d.recording;
});

document.querySelectorAll('[data-action="record-stop"]').forEach(b=>{
    b.disabled=!on||!d.recording;
});
}
async function refreshStatus(){
    try{
        const d = await api("/api/status");
        renderStatus(d);

        const message = $("camera-control-message");
        if(message && !message.dataset.manualAction){
            message.textContent = d.camera_on
                ? "MediaMTX autostarted"
                : "MediaMTX stopped";
        }
    }catch(e){
        $("cam-status").textContent="● SERVER OFFLINE";
        $("cam-status").className="status bad";
        if($("camera-control-message"))$("camera-control-message").textContent="Dashboard backend unavailable";
        setDisabled(true);
    }
}
async function cameraOn(){const m=$("camera-control-message");m.textContent="Starting MediaMTX…";try{await api("/api/camera/on",{method:"POST"});m.textContent="MediaMTX started";m.dataset.manualAction="true";await loadWebRTC();await refreshStatus()}catch(e){m.textContent=e.message}}
async function cameraOff(){const m=$("camera-control-message");m.textContent="Stopping recording and MediaMTX…";try{await api("/api/camera/off",{method:"POST"});m.textContent="MediaMTX stopped";m.dataset.manualAction="true";$("webrtc-player").src="about:blank";$("stream-message").textContent="Camera is OFF. Turn it ON to reconnect.";await refreshStatus()}catch(e){m.textContent=e.message}}
async function loadWebRTC(camera = "cam1") {
    const playerId = camera === "cam1"
        ? "webrtc-player"
        : "webrtc-player-cam2";

    const tileId = camera === "cam1"
        ? "cam1-tile"
        : "cam2-tile";

    const player = $(playerId);
    const tile = $(tileId);

    if (!player || !tile) return;

    const message = tile.querySelector(".camera-offline small");

    try {
        const d = await api(`/api/stream-info?camera=${camera}`);

        if (d.url) {
            player.src = d.url;
            player.style.display = "block";
            tile.classList.remove("offline");
            tile.classList.add("online");

            if (message) {
                message.textContent = d.name + " stream connected";
            }
        }
    } catch (e) {
        player.src = "about:blank";
        tile.classList.remove("online");
        tile.classList.add("offline");

        if (message) {
            message.textContent = e.message;
        }
    }
}
async function capture(){
    try{
        const d=await api(`/api/capture?camera=${selectedCamera}`,{method:"POST"});
        $("capture-result").textContent=`Saved ${d.file} to SD card.`;
        if($("capture-result-page"))$("capture-result-page").textContent=`Saved ${d.file}`;
        await loadMedia();
    }catch(e){
        $("capture-result").textContent=e.message;
    }
}
async function recordStart(){
    const choice = window.prompt(
        "Select camera for recording:\n\n1 = HAWKEYE (CAM1)\n2 = NV_Cam (CAM2)\n3 = BOTH cameras",
        "1"
    );

    if(choice === null) return;

    const selection = choice.trim().toLowerCase();
    let camera;

    if(["1","cam1","hawkeye"].includes(selection)){
        camera = "cam1";
    }else if(["2","cam2","nv_cam"].includes(selection)){
        camera = "cam0";
    }else if(["3","both"].includes(selection)){
        camera = "both";
    }else{
        $("record-result").textContent="Invalid selection. Choose 1, 2, or 3.";
        return;
    }

    try{
        const d=await api(`/api/record/start?camera=${camera}`,{method:"POST"});
        const message=`Recording ${d.camera_name}: ${d.file}`;
        $("record-result").textContent=message;
        if($("record-result-page"))$("record-result-page").textContent=message;
        await refreshStatus();
    }catch(e){
        $("record-result").textContent=e.message;
        if($("record-result-page"))$("record-result-page").textContent=e.message;
    }
}
async function recordStop(){try{const d=await api("/api/record/stop",{method:"POST"});$("record-result").textContent=d.interrupted?"Recording interrupted because SD storage became unavailable.":`Recording stopped: ${d.file||"none"}`;if($("record-result-page"))$("record-result-page").textContent=$("record-result").textContent;await refreshStatus()}catch(e){$("record-result").textContent=e.message}}
async function loadMedia(){const box=$("media-list");if(!box)return;try{const items=await api("/api/media");box.innerHTML="";if(!items.length){box.textContent="No media files yet.";return}for(const item of items){const card=document.createElement("div");card.className="media-card";const title=document.createElement("b");title.textContent=item.name;const meta=document.createElement("small");meta.textContent=`${item.kind} · ${fmtBytes(item.size)}`;const link=document.createElement("a");link.href=`/api/media/${item.kind==="image"?"Images":"Videos"}/${encodeURIComponent(item.name)}`;link.textContent="Open / download";link.target="_blank";card.append(title,meta,document.createElement("br"),link);box.append(card)}}catch(e){box.textContent=e.message}}

/* SKYSCRAPER_CAMERA_STATUS_TASK */
async function loadCameraInventory() {
    const message = $("status-refresh-message");
    const hardwareSummary = $("hardware-camera-summary");
    const hardwareOutput = $("hardware-camera-output");
    const service = $("status-mediamtx-service");
    const pathsBox = $("mediamtx-path-status");
    const dashboardBox = $("dashboard-camera-status");

    if (message) message.textContent = "Refreshing camera and stream status...";

    try {
        const d = await api("/api/camera/inventory");
        const h = d.hardware || {};
        const m = d.mediamtx || {};
        const paths = m.paths || {};

        if (hardwareSummary) {
            hardwareSummary.textContent =
                "Hardware: " + (h.detected ? "DETECTED" : "NOT DETECTED") +
                " · Status: " + (h.status || "UNKNOWN") +
                (h.name ? " · Sensor: " + h.name : "");
        }

        if (hardwareOutput) {
            const lines = [];
            lines.push("Detection: " + (h.detected ? "Yes" : "No"));
            lines.push("Status: " + (h.status || "Unknown"));
            lines.push("Sensor: " + (h.name || "Not identified"));
            lines.push("Checked: " + (h.checked_at || "Not available"));
            lines.push("");
            lines.push("Sensor modes:");

            if (Array.isArray(h.sensors) && h.sensors.length) {
                h.sensors.forEach(sensor => {
                    if (typeof sensor === "string") {
                        lines.push("- " + sensor);
                    } else {
                        lines.push("- " + JSON.stringify(sensor));
                    }
                });
            } else {
                lines.push("No sensor modes reported.");
            }

            lines.push("");
            lines.push("Detection output:");
            lines.push(h.raw_output || "No diagnostic output available.");

            hardwareOutput.textContent = lines.join("\n");
        }

        if (service) {
            service.textContent = m.running
                ? "RUNNING"
                : "STOPPED / UNAVAILABLE";
            service.style.color = m.running ? "#16a34a" : "#dc2626";
        }

        if (pathsBox) {
            pathsBox.textContent = "";

            if (!m.running) {
                pathsBox.textContent = "MediaMTX is not running.";
            } else if (!paths.available) {
                pathsBox.textContent =
                    "MediaMTX API unavailable: " +
                    (paths.error || "No response");
            } else {
                const items = Array.isArray(paths.items) ? paths.items : [];
                const expected = [
                    {name: "cam1", label: "HAWKEYE (CAM1)"},
                    {name: "cam0", label: "NV_Cam (CAM2)"}
                ];

                expected.forEach(camera => {
                    const item = items.find(p => p.name === camera.name);
                    const row = document.createElement("div");
                    row.className = "statline";

                    const label = document.createElement("span");
                    label.textContent = camera.label;

                    const value = document.createElement("b");

                    if (!item) {
                        value.textContent = "PATH NOT LISTED";
                    } else {
                        const ready = !!item.ready;
                        value.textContent = ready ? "READY" : "NOT READY";

                        if (item.source_type) {
                            value.textContent += " · " + item.source_type;
                        }

                        if (Array.isArray(item.video) && item.video.length) {
                            const video = item.video[0];
                            if (video.width && video.height) {
                                value.textContent +=
                                    " · " + video.width + "x" + video.height;
                            }
                            if (video.codec) {
                                value.textContent += " · " + video.codec;
                            }
                        }
                    }

                    row.append(label, value);
                    pathsBox.append(row);
                });
            }
        }

        if (dashboardBox) {
            dashboardBox.textContent = "";

            const items = Array.isArray(paths.items) ? paths.items : [];

            let savedNames = {};
            try {
                savedNames = JSON.parse(
                    localStorage.getItem("skyscraper_camera_display_names") || "{}"
                );
            } catch (error) {
                savedNames = {};
            }

            document.querySelectorAll(".camera-tile").forEach(tile => {
                if (tile.id === "add-camera-tile") return;

                const labelElement = tile.querySelector(".camera-tile-label");
                if (!labelElement) return;

                const cameraId = tile.id || tile.dataset.cameraId;

                const cameraName =
                    savedNames[cameraId] ||
                    labelElement.dataset.displayName ||
                    labelElement.childNodes[0]?.textContent?.trim() ||
                    tile.dataset.cameraName ||
                    tile.id ||
                    "Camera";

                let connected = false;
                let pathName = null;

                if (tile.id === "cam1-tile") {
                    pathName = "cam1";
                } else if (tile.id === "cam2-tile") {
                    pathName = "cam0";
                }

                let statusText = tile.classList.contains("online")
                    ? "CONNECTED"
                    : "DISCONNECTED";

                if (pathName) {
                    const item = items.find(p => p.name === pathName);

                    connected = !!(
                        m.running &&
                        paths.available &&
                        item &&
                        item.ready
                    );

                    statusText = connected ? "CONNECTED" : "DISCONNECTED";
                }

                const row = document.createElement("div");
                row.className = "statline";

                const label = document.createElement("span");
                label.textContent = cameraName;

                const value = document.createElement("b");
                value.textContent = statusText;
                value.style.color =
                    statusText === "CONNECTED" ? "#16a34a" :
                    statusText === "DISCONNECTED" ? "#dc2626" : "#64748b";

                row.append(label, value);
                dashboardBox.append(row);
            });
        }

        if (message) {
            message.textContent =
                "Status refreshed: " + (d.checked_at || "time unavailable");
        }

    } catch (error) {
        if (message) message.textContent = "Status refresh failed: " + error.message;
        if (hardwareSummary) hardwareSummary.textContent = "Camera status unavailable";
        if (hardwareOutput) hardwareOutput.textContent = error.message;
        if (service) service.textContent = "Status unavailable";
        if (pathsBox) pathsBox.textContent = "Unable to retrieve MediaMTX paths.";
        if (dashboardBox) dashboardBox.textContent = "Dashboard status unavailable.";
    }
}

$("refresh-camera-status")?.addEventListener("click", loadCameraInventory);

function bindPages(){document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+b.dataset.page));$("page-title").textContent=b.querySelector("span")?.textContent||b.textContent.trim();if(b.dataset.page==="library")loadMedia();if(b.dataset.page==="advanced")loadAdvanced();if(b.dataset.page==="status")loadCameraInventory()}))}
document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{if(b.disabled)return;({capture, "record-start":recordStart, "record-stop":recordStop}[b.dataset.action]||(()=>{}))()}));
if($("camera-on"))$("camera-on").addEventListener("click",cameraOn);if($("camera-off"))$("camera-off").addEventListener("click",cameraOff);
if($("reload-media"))$("reload-media").addEventListener("click",loadMedia);

/* SKYSCRAPER camera selection and retry */
function selectCamera(camera) {
    selectedCamera = camera;

    document.querySelectorAll(".camera-tile").forEach(tile => {
        tile.classList.toggle(
            "selected-camera",
            tile.id === (camera === "cam1" ? "cam1-tile" : "cam2-tile")
        );
    });

    const label = camera === "cam1" ? "HAWKEYE" : "NV_Cam";
    $("stream-message").textContent = `${label} selected for capture and recording.`;
}

$("cam1-tile")?.addEventListener("click", () => selectCamera("cam1"));
$("cam2-tile")?.addEventListener("click", () => selectCamera("cam0"));

document.querySelectorAll("[data-camera-retry]").forEach(button => {
    button.addEventListener("click", event => {
        event.stopPropagation();

        const camera = button.dataset.cameraRetry === "cam1" ? "cam1" : "cam0";
        loadWebRTC(camera);
    });
});

if($("logout"))$("logout").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST"})}finally{location.href="/"}});
async function loadAdvanced(){try{const d=await api("/api/advanced-settings"),s=d.settings,form=$("advanced-form");for(const [k,v] of Object.entries(s)){const el=form.elements.namedItem(k);if(el)el.value=v}const select=form.elements.namedItem("clock_sync");select.innerHTML="";d.clock_sync_options.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;select.append(o)});select.value=s.clock_sync}catch(e){$("advanced-message").textContent=e.message}}
if($("advanced-form"))$("advanced-form").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,data={};for(const el of form.elements){if(el.name)data[el.name]=el.type==="number"?Number(el.value):el.value}try{const r=await api("/api/advanced-settings",{method:"PUT",body:JSON.stringify(data)});$("advanced-message").textContent="Saved settings on CM4."}catch(err){$("advanced-message").textContent=err.message}});
if($("advanced-reset"))$("advanced-reset").addEventListener("click",async()=>{const defaults={file_cache_ms:1000,live_capture_cache_ms:300,disc_cache_ms:300,network_cache_ms:35,clock_average_counter:40,clock_sync:"Default",clock_jitter_ms:5000};try{await api("/api/advanced-settings",{method:"PUT",body:JSON.stringify(defaults)});await loadAdvanced();$("advanced-message").textContent="Defaults restored."}catch(e){$("advanced-message").textContent=e.message}});

/* SKYSCRAPER owner user management */
async function loadUsers() {
    const list = $("users-list");
    const message = $("users-message");

    if (!list || !message) return;

    list.textContent = "Loading registered users...";
    message.textContent = "";

    try {
        const users = await api("/api/users");
        list.innerHTML = "";

        if (!users.length) {
            list.textContent = "No registered users found.";
            return;
        }

        const table = document.createElement("table");
        table.className = "users-table";

        const header = document.createElement("tr");
        ["Username", "Registered", "Actions"].forEach(label => {
            const th = document.createElement("th");
            th.textContent = label;
            header.append(th);
        });

        const thead = document.createElement("thead");
        thead.append(header);
        table.append(thead);

        const tbody = document.createElement("tbody");

        users.forEach(user => {
            const row = document.createElement("tr");

            const username = document.createElement("td");
            username.textContent = user.username;

            const date = document.createElement("td");
            date.textContent = user.created_at
                ? new Date(user.created_at).toLocaleString()
                : "Unknown";

            const actions = document.createElement("td");

            if (user.is_owner) {
                const owner = document.createElement("strong");
                owner.textContent = "OWNER";
                owner.className = "owner-label";
                actions.append(owner);
            } else {
                const button = document.createElement("button");
                button.textContent = "DELETE";
                button.className = "danger";

                button.addEventListener("click", async () => {
                    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;

                    button.disabled = true;

                    try {
                        const result = await api(
                            `/api/users/${encodeURIComponent(user.username)}`,
                            {method: "DELETE"}
                        );

                        if (result.ok && result.redirect) {
                            window.location.replace(result.redirect);
                            return;
                        }

                        message.textContent = result.message;
                        await loadUsers();
                    } catch (error) {
                        message.textContent = error.message;
                        button.disabled = false;
                    }
                });

                actions.append(button);
            }

            row.append(username, date, actions);
            tbody.append(row);
        });

        table.append(tbody);
        list.append(table);

    } catch (error) {
        list.textContent = error.message;
    }
}

document.querySelector('[data-page="users"]')?.addEventListener("click", loadUsers);
$("refresh-users")?.addEventListener("click", loadUsers);

bindPages();refreshStatus();loadWebRTC("cam1");setInterval(refreshStatus,3000);


/* SKYSCRAPER_ABOUT_TASK1 */
document.querySelector('[data-page="about"]')?.addEventListener("click", loadAbout);

async function loadAbout() {
    const message = document.getElementById("about-message");
    const details = document.getElementById("about-details");

    if (!message || !details) return;

    message.textContent = "Loading account information...";
    details.innerHTML = "";

    try {
        const response = await fetch("/api/about", {
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error("Could not load About information. Please sign in again.");
        }

        const data = await response.json();

        const ua = navigator.userAgent || "";
        let platform = "Unknown device";

        if (/iPhone|iPad|iPod/i.test(ua)) {
            platform = "iPhone / iOS";
        } else if (/Android/i.test(ua)) {
            platform = "Android";
        } else if (/Windows/i.test(ua)) {
            platform = "Windows";
        } else if (/Macintosh|Mac OS/i.test(ua)) {
            platform = "Mac";
        } else if (/Linux/i.test(ua)) {
            platform = "Linux";
        }

        const rows = [
            ["Application Owner", data.owner],
            ["Currently Logged-in User", data.username],
            ["Registered Phone", data.phone],
            ["Device Platform", platform],
            ["Camera Name", data.camera_name],
            ["Camera Detected", data.camera_detected ? "Yes" : "No"],
            ["Camera Status", data.camera_status]
        ];

        const table = document.createElement("table");
        table.className = "about-table";

        for (const [label, value] of rows) {
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            const td = document.createElement("td");

            th.textContent = label;
            td.textContent = value ?? "Unavailable";

            tr.append(th, td);
            table.appendChild(tr);
        }

        details.appendChild(table);
        message.textContent = "Account and device information";
    } catch (error) {
        message.textContent = error.message || "Unable to load About information.";
    }
}


/* SKYSCRAPER dynamic camera dashboard */
(function initCameraGrid() {
    const grid = document.getElementById("camera-grid");
    if (!grid) return;

    const addTile = document.getElementById("add-camera-tile");
    const STORAGE_KEY = "skyscraper.customCameras.v1";

    function getSavedCameras() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.warn("Could not read saved camera configuration:", error);
            return [];
        }
    }

    function saveCameras() {
        const cameras = [...grid.querySelectorAll(".custom-camera-tile")].map(tile => ({
            id: tile.dataset.cameraId,
            name: tile.dataset.cameraName,
            url: tile.dataset.cameraUrl
        }));

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras));
        } catch (error) {
            alert("Unable to save camera configuration in this browser.");
        }
    }

    function setLayout(layout) {
        grid.dataset.layout = layout;

        document.querySelectorAll("[data-camera-layout]").forEach(button => {
            button.classList.toggle("active", button.dataset.cameraLayout === layout);
        });
    }

    function createCameraTile(camera, persist = true) {
        const tile = document.createElement("div");
        tile.className = "camera-tile online custom-camera-tile";
        tile.id = camera.id;
        tile.dataset.cameraId = camera.id;
        tile.dataset.cameraName = camera.name;
        tile.dataset.cameraUrl = camera.url;

        const label = document.createElement("div");
        label.className = "camera-tile-label";
        label.textContent = camera.name;

        const iframe = document.createElement("iframe");
        iframe.title = camera.name + " live camera";
        iframe.allow = "autoplay; fullscreen; picture-in-picture";
        iframe.src = camera.url;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "camera-remove-btn";
        remove.textContent = "−";
        remove.title = "Remove camera";
        remove.setAttribute("aria-label", "Remove " + camera.name);

        remove.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            if (!confirm(`Remove ${camera.name} from this browser's dashboard?`)) return;

            tile.remove();
            if (persist) saveCameras();
        });

        tile.append(label, iframe, remove);

        // Insert before the persistent Add Camera tile.
        if (addTile && addTile.parentElement === grid) {
            grid.insertBefore(tile, addTile);
        } else {
            grid.appendChild(tile);
        }

        return tile;
    }

    function addCamera() {
        const name = prompt("Enter camera name (example: NV_Cam):");
        if (!name || !name.trim()) return;

        const streamUrl = prompt(
            "Enter browser-compatible WebRTC/HLS URL:",
            "http://192.168.1.8:8889/cam0"
        );

        if (!streamUrl || !streamUrl.trim()) return;

        let url;
        try {
            url = new URL(streamUrl.trim(), window.location.href);

            if (!["http:", "https:"].includes(url.protocol)) {
                alert("Please enter an HTTP or HTTPS stream URL.");
                return;
            }
        } catch {
            alert("Invalid stream URL.");
            return;
        }

        const camera = {
            id: "custom-camera-" + Date.now(),
            name: name.trim(),
            url: url.href
        };

        createCameraTile(camera);
        saveCameras();
        setLayout("2");

        const message = document.getElementById("stream-message");
        if (message) {
            message.textContent = `${camera.name} added to this browser's dashboard.`;
        }
    }

    // Keep existing grid layout controls.
    document.querySelectorAll("[data-camera-layout]").forEach(button => {
        button.addEventListener("click", () => setLayout(button.dataset.cameraLayout));
    });

    // Keep camera ON/OFF visual controls.
    document.getElementById("camera-on")?.addEventListener("click", () => {
        grid.querySelectorAll(".camera-tile").forEach(tile => {
            tile.classList.remove("disabled-camera");
        });
    });

    document.getElementById("camera-off")?.addEventListener("click", () => {
        grid.querySelectorAll(".camera-tile").forEach(tile => {
            tile.classList.add("disabled-camera");
        });
    });

    // Add Camera tile: mouse, keyboard, and mobile-friendly interaction.
    if (addTile) {
        addTile.addEventListener("click", addCamera);
        addTile.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                addCamera();
            }
        });
    }

    // Restore user-added cameras from this browser's localStorage.
    getSavedCameras().forEach(camera => {
        if (!camera || !camera.name || !camera.url || !camera.id) return;

        try {
            const url = new URL(camera.url);
            if (["http:", "https:"].includes(url.protocol)) {
                createCameraTile(camera, false);
            }
        } catch (error) {
            console.warn("Skipping invalid saved camera:", camera);
        }
    });

    // Automatically reconnect the default HAWKEYE camera.
    if (typeof loadWebRTC === "function") {
        loadWebRTC("cam1");
    }
})();


/* SKYSCRAPER CAMERA NAME EDITOR */
(function () {
    const STORAGE_KEY = "skyscraper_camera_display_names";

    function getNames() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function saveName(tile, label, name) {
        const names = getNames();
        const key = tile.id || tile.dataset.cameraId;
        if (!key) return;

        names[key] = name;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(names));

        label.dataset.displayName = name;
        label.childNodes[0].textContent = name;

        if (tile.dataset.cameraName !== undefined) {
            tile.dataset.cameraName = name;
        }

        const iframe = tile.querySelector("iframe");
        if (iframe) iframe.title = name + " live camera";

        // Keep the existing custom-camera storage synchronized.
        if (typeof saveCameras === "function") {
            try { saveCameras(); } catch (e) {}
        }
    }

    function setupLabel(label) {
        if (label.dataset.nameEditorReady) return;

        const tile = label.closest(".camera-tile");
        if (!tile) return;

        label.dataset.nameEditorReady = "true";

        const key = tile.id || tile.dataset.cameraId;
        const names = getNames();
        const original = label.textContent.trim();
        const saved = names[key];

        label.dataset.displayName = saved || original;

        // Preserve the original visible label as editable display text.
        const textNode = document.createTextNode(saved || original);
        label.textContent = "";
        label.appendChild(textNode);

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "camera-name-edit-btn";
        edit.textContent = "✎";
        edit.title = "Edit camera display name";
        edit.setAttribute("aria-label", "Edit camera display name");

        edit.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            const current = label.dataset.displayName || original;
            const next = prompt("Enter camera display name:", current);

            if (next === null || !next.trim()) return;

            saveName(tile, label, next.trim());
        });

        label.appendChild(edit);
    }

    function initialize() {
        document.querySelectorAll(".camera-tile-label").forEach(setupLabel);
    }

    initialize();

    // Support camera tiles added dynamically.
    const observer = new MutationObserver(initialize);
    observer.observe(document.body, { childList: true, subtree: true });
})();
/* END SKYSCRAPER CAMERA NAME EDITOR */

/* End of SKYSCRAPER dynamic camera dashboard */



 // Poll for terminal-triggered account deletion
(function watchTerminalDeletion() {
    async function checkDeletion() {
        try {
            const response = await fetch(
                "/api/admin/deletion-event",
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) return;

            const result = await response.json();

            if (result.redirect) {
                window.location.replace(result.redirect);
            }
        } catch (error) {
            console.warn("Deletion notification check failed:", error);
        }
    }

    checkDeletion();
    setInterval(checkDeletion, 2000);
})();
