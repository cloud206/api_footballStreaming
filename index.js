const ALLOWED_ORIGIN = "*";

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event).catch(handleError));
});

function handleError(err) {
  return new Response(JSON.stringify({
    error: "Worker failed",
    message: err.message,
    stack: err.stack,
  }), {
    status: 500,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);

  // CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  if (!["/matches", "/matches/"].includes(url.pathname)) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      },
    });
  }

  const referer = "https://socolivev.co/";
  // iOS Safari friendly User-Agent
  const agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

  const dates = [
    formatDate(Date.now() - 86400000),
    formatDate(Date.now()),
    formatDate(Date.now() + 86400000),
  ];

  let all = [];
  for (const d of dates) {
    const matches = await fetchMatches(d, referer, agent);
    all = all.concat(matches);
  }

  return new Response(JSON.stringify(all, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    }
  });
}

function formatDate(ms) {
  return new Date(ms).toISOString().split("T")[0].replace(/-/g, "");
}

// Fetch server URLs concurrently
async function fetchServerURLs(anchors, referer) {
  const promises = anchors.map(async a => {
    const room = a.anchor.roomNum;
    try {
      const res = await fetch(`https://json.vnres.co/room/${room}/detail.json`);
      const txt = await res.text();
      const m = txt.match(/detail\((.*)\)/);
      if (m) {
        const js = JSON.parse(m[1]);
        if (js.code === 200) {
          const s = js.data.stream;
          const servers = [];
          if (s.m3u8) servers.push({ name: "Soco SD", stream_url: s.m3u8, referer });
          if (s.hdM3u8) servers.push({ name: "Soco HD", stream_url: s.hdM3u8, referer });
          return servers;
        }
      }
    } catch (e) {
      console.warn(`room ${room} error:`, e.message);
    }
    return [];
  });

  const results = await Promise.all(promises);
  return results.flat();
}

async function fetchMatches(date, referer, agent) {
  try {
    const res = await fetch(`https://json.vnres.co/match/matches_${date}.json`, {
      headers: { referer, "user-agent": agent, origin: "https://json.vnres.co" }
    });
    const txt = await res.text();
    const m = txt.match(/matches_\d+\((.*)\)/s); // /s flag to include newlines
    if (!m) return [];
    const js = JSON.parse(m[1]);
    if (js.code !== 200) return [];

    const now = Math.floor(Date.now() / 1000);
    const matchDur = 2 * 3600;
    const results = [];

    for (const it of js.data) {
      const mt = Math.floor(it.matchTime / 1000);
      let status;
      if (now >= mt && now <= mt + matchDur) status = "live";
      else if (now > mt + matchDur) status = "finished";
      else status = "vs";

      const homeScore = it.homeScore ?? null;
      const awayScore = it.awayScore ?? null;
      const match_score = (homeScore !== null && awayScore !== null)
        ? `${homeScore} - ${awayScore}`
        : null;

      let servers = [];
      if (status === "live" && it.anchors) {
        servers = await fetchServerURLs(it.anchors, referer);
      }

      results.push({
        match_time: mt.toString(),
        match_status: status,
        home_team_name: it.hostName,
        home_team_logo: it.hostIcon,
        away_team_name: it.guestName,
        away_team_logo: it.guestIcon,
        league_name: it.subCateName,
        match_score,
        servers
      });
    }

    return results;

  } catch (e) {
    console.warn(`matches ${date} error:`, e.message);
    return [];
  }
}
