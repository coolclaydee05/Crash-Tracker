let map, marker, polyline, path = [], currentDeviceId = null, devices = [];
function initMap(lat=11.0, lng=124.0){
  map = L.map('map').setView([lat, lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  marker = L.marker([lat, lng]).addTo(map);

  polyline = L.polyline(path, {color: 'red', weight: 3}).addTo(map);
}

async function loadDevices(){
  const user = JSON.parse(sessionStorage.getItem("user"));
  if (!user) return window.location = "/";
  try {
    const res = await fetch("/devices", { headers: { 'user-email': user.email } });
    devices = await res.json();
    const select = document.getElementById("deviceSelect");
    select.innerHTML = '<option value="">Select a device</option>';
    devices.forEach(d => {
      const option = document.createElement("option");
      option.value = d.id;
      option.textContent = d.name;
      select.appendChild(option);
    });
    if (devices.length > 0) {
      select.value = devices[0].id;
      currentDeviceId = devices[0].id;
    }
  } catch (e) {
    console.error(e);
  }
}

async function fetchLatest(){
  if (!currentDeviceId) return;
  try {
    const res = await fetch(`/tracker/latest?deviceId=${currentDeviceId}`);
    const data = await res.json();
    const statusElement = document.getElementById("conn");
    const statusIndicator = document.querySelector(".status-indicator");
    statusElement.innerText = data.status || "OFFLINE";
    if (data.status === "ONLINE") {
      statusIndicator.className = "status-indicator status-online";
    } else {
      statusIndicator.className = "status-indicator status-offline";
    }
    document.getElementById("last").innerText = new Date(data.timestamp).toLocaleString();
    document.getElementById("gforce").innerText = data.gforce;
    document.getElementById("gyro").innerText = data.gyro;
    if (!map) initMap(data.lat, data.lng);
    marker.setLatLng([data.lat, data.lng]);
    map.setView([data.lat, data.lng], 14);
    // Update path for polyline only if online
    if (data.status === "ONLINE") {
      path.push([data.lat, data.lng]);
      if (path.length > 100) path.shift(); // Keep last 100 points
      polyline.setLatLngs(path);
    } else {
      // Clear path when offline
      path = [];
      polyline.setLatLngs([]);
    }
    // Check for crash and notify
    if (data.crash) {
      // Show UI notification on dashboard
      const notification = document.getElementById("crashNotification");
      notification.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>CRASH DETECTED on ${devices.find(d => d.id === currentDeviceId)?.name || currentDeviceId}! Check device status immediately.`;
      notification.classList.remove("hidden");
      // Hide after 10 seconds
      setTimeout(() => notification.classList.add("hidden"), 10000);

      alert(`CRASH DETECTED on ${devices.find(d => d.id === currentDeviceId)?.name || currentDeviceId}! G-Force exceeded threshold.`);
      if (Notification.permission === "granted") {
        new Notification("Crash Alert", { body: `Motorcycle crash detected on ${devices.find(d => d.id === currentDeviceId)?.name || currentDeviceId}!` });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            new Notification("Crash Alert", { body: `Motorcycle crash detected on ${devices.find(d => d.id === currentDeviceId)?.name || currentDeviceId}!` });
          }
        });
      }
    }
  } catch (e) {
    console.error(e);
  }
}

document.getElementById("deviceSelect").addEventListener("change", (e) => {
  currentDeviceId = e.target.value;
  path = []; // Reset path for new device
  fetchLatest();
  fetchCrashHistory();
});

document.getElementById("registerBtn").addEventListener("click", async () => {
  const deviceId = document.getElementById("deviceId").value.trim();
  const deviceName = document.getElementById("deviceName").value.trim();
  if (!deviceId || !deviceName) return alert("Please fill in both fields.");
  const user = JSON.parse(sessionStorage.getItem("user"));
  try {
    const res = await fetch("/devices/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", 'user-email': user.email },
      body: JSON.stringify({ deviceId, deviceName })
    });
    const result = await res.json();
    if (result.ok) {
      alert("Device registered successfully!");
      document.getElementById("deviceId").value = "";
      document.getElementById("deviceName").value = "";
      loadDevices();
    } else {
      alert(result.error);
    }
  } catch (e) {
    console.error(e);
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", ()=>{ sessionStorage.removeItem("user"); window.location = "/"; });

async function fetchCrashHistory(){
  if (!currentDeviceId) return;
  try {
    const res = await fetch(`/tracker/history?deviceId=${currentDeviceId}`);
    const history = await res.json();
    const tbody = document.getElementById("crashTableBody");
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="border border-gray-300 px-4 py-2 text-center text-gray-500">No crash history available</td></tr>';
      return;
    }
    tbody.innerHTML = history.map(crash => `
      <tr>
        <td class="border border-gray-300 px-4 py-2">${new Date(crash.timestamp).toLocaleString()}</td>
        <td class="border border-gray-300 px-4 py-2">${crash.lat.toFixed(6)}, ${crash.lng.toFixed(6)}</td>
        <td class="border border-gray-300 px-4 py-2">${crash.gforce}</td>
        <td class="border border-gray-300 px-4 py-2">${crash.gyro}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

setInterval(fetchLatest, 1000);

// Update clock every second
setInterval(() => {
  const now = new Date();
  document.getElementById("currentTime").innerText = now.toLocaleString();
}, 1000);

window.onload = () => {
  loadDevices();
  fetchLatest();
  fetchCrashHistory();
  // Initialize clock
  const now = new Date();
  document.getElementById("currentTime").innerText = now.toLocaleString();
};
