import { config } from "../config.js";

export async function handleLoginFormSubmit(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    const response = await fetch(`${config.apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      if (data.data?.tokens?.accessToken) {
        const secureFlag =
          window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `accessToken=${data.data.tokens.accessToken}; Path=/; SameSite=Strict${secureFlag}`;
      }
      console.log(
        "accessToken",
        document.cookie.match(/(?:^|; )accessToken=([^;]*)/)
      );
      console.log("Login successful", data);
    } else {
      // Handle error (e.g., show error message)
      console.error("Login failed", data);
    }
  } catch (err) {
    console.error("Network error", err);
  }
}
