let map, marker;

window.onload = () => {
  if (!localStorage.getItem("logged")) {
    window.location = "index.html";
    return;
  }
  initMap();
  fetchData();
  setInterval(fetchData, 1500);
};

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 16,
    center: { lat: 11.0, lng: 124.0 }
  });

  marker = new google.maps.Marker({
    position: { lat: 11.0, lng: 124.0 },
    map: map
  });
}

function fetchData() {
  fetch("/tracker/latest")
    .then(r => r.json())
    .then(data => {
      document.getElementById("status").innerText = "Status: " + data.status;
      document.getElementById("gforce").innerText = "G-force: " + data.gforce;
      document.getElementById("gyro").innerText = "Gyro: " + data.gyro;
      document.getElementById("timestamp").innerText = "Updated: " + data.timestamp;

      let pos = { lat: data.lat, lng: data.lng };
      marker.setPosition(pos);
      map.setCenter(pos);
    });
}
