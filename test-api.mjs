async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/scraping/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: "25a8fa9c-3beb-4b7b-b231-b4a58bec20b9" })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
test();
