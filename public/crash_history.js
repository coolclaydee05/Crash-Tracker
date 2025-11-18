// crash_history.js

document.addEventListener('DOMContentLoaded', () => {
  const deviceSelect = document.getElementById('deviceSelect');
  const crashTableBody = document.getElementById('crashTableBody');
  const thresholdInput = document.getElementById('thresholdInput');
  const updateThresholdBtn = document.getElementById('updateThresholdBtn');
  const thresholdMessage = document.getElementById('thresholdMessage');
  const backBtn = document.getElementById('backBtn');

  // Load devices
  const user = JSON.parse(sessionStorage.getItem("user"));
  const userEmail = user ? user.email : 'test@example.com'; // Use session user email or default for testing
  fetch('/devices', {
    headers: { 'user-email': userEmail }
  })
    .then(res => res.json())
    .then(devices => {
      deviceSelect.innerHTML = '<option value="">Select a device</option>';
      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.name;
        deviceSelect.appendChild(option);
      });
    })
    .catch(err => console.error('Error loading devices:', err));

  // Load threshold
  fetch('/threshold')
    .then(res => res.json())
    .then(data => {
      thresholdInput.value = data.value;
    })
    .catch(err => console.error('Error loading threshold:', err));

  // Handle device selection
  deviceSelect.addEventListener('change', () => {
    const deviceId = deviceSelect.value;
    if (!deviceId) {
      crashTableBody.innerHTML = '<tr><td colspan="4" class="border border-gray-300 px-4 py-2 text-center text-gray-500">Select a device to view crash history</td></tr>';
      return;
    }
    fetch(`/tracker/history?deviceId=${deviceId}`)
      .then(res => res.json())
      .then(crashes => {
        crashTableBody.innerHTML = '';
        if (crashes.length === 0) {
          crashTableBody.innerHTML = '<tr><td colspan="4" class="border border-gray-300 px-4 py-2 text-center text-gray-500">No crash history available</td></tr>';
          return;
        }
        crashes.forEach(crash => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="border border-gray-300 px-4 py-2">${new Date(crash.timestamp).toLocaleString()}</td>
            <td class="border border-gray-300 px-4 py-2">${crash.lat.toFixed(4)}, ${crash.lng.toFixed(4)}</td>
            <td class="border border-gray-300 px-4 py-2">${crash.gforce}</td>
            <td class="border border-gray-300 px-4 py-2">${crash.gyro}</td>
          `;
          crashTableBody.appendChild(row);
        });
      })
      .catch(err => console.error('Error loading crash history:', err));
  });

  // Handle threshold update
  updateThresholdBtn.addEventListener('click', () => {
    const value = parseFloat(thresholdInput.value);
    if (isNaN(value) || value <= 0) {
      thresholdMessage.textContent = 'Please enter a valid positive number.';
      thresholdMessage.className = 'mt-2 text-sm text-red-600';
      return;
    }
    fetch('/threshold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          thresholdMessage.textContent = 'Threshold updated successfully!';
          thresholdMessage.className = 'mt-2 text-sm text-green-600';
        } else {
          throw new Error('Update failed');
        }
      })
      .catch(err => {
        console.error('Error updating threshold:', err);
        thresholdMessage.textContent = 'Failed to update threshold.';
        thresholdMessage.className = 'mt-2 text-sm text-red-600';
      });
  });

  // Back to dashboard
  backBtn.addEventListener('click', () => {
    window.location.href = '/dashboard.html';
  });
});
