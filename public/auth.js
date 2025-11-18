document.addEventListener("DOMContentLoaded", ()=> {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");

  if (signupForm) {
    signupForm.addEventListener("submit", (e)=> {
      e.preventDefault();
      const name = document.getElementById("name").value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      if (users.find(u=>u.email===email)) { alert("Email exists"); return; }
      users.push({ name, email, password });
      localStorage.setItem("users", JSON.stringify(users));
      alert("Account created");
      window.location = "/";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e)=> {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const user = users.find(u=>u.email===email && u.password===password);
      if (!user) { alert("Invalid credentials"); return; }
      sessionStorage.setItem("user", JSON.stringify({ name: user.name, email: user.email }));
      window.location = "/dashboard.html";
    });
  }
});
