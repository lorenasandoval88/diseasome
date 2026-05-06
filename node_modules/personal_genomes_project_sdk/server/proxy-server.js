import express from "express";
import https from "https";

// Allow self-signed certificates (for corporate/school network proxies)
// This is needed when running behind a network proxy that intercepts SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const PORT = process.env.PORT || 3000;
const PGP_STATS_URL = "https://my.pgp-hms.org/public_genetic_data/statistics";
const PGP_23ANDME_URL = "https://my.pgp-hms.org/public_genetic_data?utf8=%E2%9C%93&data_type=23andMe&commit=Search";

app.use(express.static("."));

app.get("/pgp-stats", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    console.log("Received request for /pgp-stats");
    try {
        const upstream = await fetch(PGP_STATS_URL);

        if (!upstream.ok) {
            res.status(upstream.status).send(`Upstream request failed (${upstream.status})`);
            return;
        }

        const html = await upstream.text();
        res.type("text/html").send(html);
    } catch (error) {
        res.status(502).send(`Proxy error: ${error.message}`);
    }
});

app.get("/pgp-participants", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    console.log("Received request for /pgp-participants");
    try {
        console.log("Fetching:", PGP_23ANDME_URL);
        const upstream = await fetch(PGP_23ANDME_URL);
        console.log("Upstream status:", upstream.status);

        if (!upstream.ok) {
            res.status(upstream.status).send(`Upstream request failed (${upstream.status})`);
            return;
        }

        const html = await upstream.text();
        console.log("HTML length:", html.length);
        res.type("text/html").send(html);
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(502).send(`Proxy error: ${error.message}`);
    }
});

app.get("/pgp-profile/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const { id } = req.params;
    const url = `https://my.pgp-hms.org/profile/${id}.json`;

    console.log("Fetching profile:", url);

    try {
        const upstream = await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });

        console.log("Upstream status:", upstream.status);

        if (!upstream.ok) {
            res.status(upstream.status).send(`Upstream failed (${upstream.status})`);
            return;
        }

        const json = await upstream.text(); // keep raw
        res.type("application/json").send(json);

    } catch (error) {
        console.error("Proxy error:", error);
        res.status(502).send(`Proxy error: ${error.message}`);
    }
});


app.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
});
