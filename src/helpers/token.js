class TokenHelper {
  constructor() {}

  isExpired(token) {
    // Separate the payload from the JWT token
    const base64Url = token.split(".")[1]; // The payload part is in the middle
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/"); // Change characters to match base64 standards

    // Base64 decoding to JSON string
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    // Convert JSON string to JavaScript object
    const payload = JSON.parse(jsonPayload);

    // Get exp information from payload
    const exp = payload.exp;
    // Get the current time in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    // Compare the expiration time with the current time
    return exp < currentTime;
  }
}

const tokenHelper = new TokenHelper();
export default tokenHelper;
