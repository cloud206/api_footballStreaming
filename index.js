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
  const agent = request.headers.get("user-agent") || "Custom-Agent";

  const dates = [
    formatDate(Date.now() - 86400000),
    formatDate(Date.now()),
    formatDate(Date.now() + 86400000),
  ];

  let all = [];
  for (const d of dates) {
    all = all.concat(await fetchMatches(d, referer, agent));
  }

  return new Response(JSON.stringify(all, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    }
  });
}

function formatDate(ms) {
  return new Date(ms).toISOString().split("T")[0].replace(/-/g, "");
}

async function fetchServerURL(roomNum) {
  try {
    const res = await fetch(`https://json.vnres.co/room/${roomNum}/detail.json`);
    const txt = await res.text();
    const m = txt.match(/detail\((.*)\)/);
    if (m) {
      const js = JSON.parse(m[1]);
      if (js.code === 200) {
        const s = js.data.stream;
        return { m3u8: s.m3u8, hdM3u8: s.hdM3u8 };
      }
    }
  } catch (e) {
    console.warn(`room ${roomNum} error:`, e.message);
  }
  return { m3u8: null, hdM3u8: null };
}

async function fetchMatches(date, referer, agent) {
  try {
    const res = await fetch(`https://json.vnres.co/match/matches_${date}.json`, {
      headers: { referer, "user-agent": agent, origin: "https://json.vnres.co" }
    });
    const txt = await res.text();
    const m = txt.match(/matches_\d+\((.*)\)/);
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

      const servers = [];
      if (status === "live") {
        for (const a of it.anchors) {
          const room = a.anchor.roomNum;
          const { m3u8, hdM3u8 } = await fetchServerURL(room);
          if (m3u8) servers.push({ name: "Soco SD", stream_url: m3u8, referer });
          if (hdM3u8) servers.push({ name: "Soco HD", stream_url: hdM3u8, referer });
        }
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
