# FootballLiveApi

**FootballLiveApi** is a serverless API built with Cloudflare Workers that scrapes and aggregates live football match data from publicly available sources. It is designed for educational and demonstration purposes only.

## Overview

This project demonstrates how to build a lightweight and secure proxy API to access live football match information, including match status, team names, league details, scores, and streaming URLs.

## Features

- Fetches and parses live football match data from a third-party JSONP endpoint.
- Converts raw data into a clean, structured JSON format.
- Includes streaming links for live matches with SD/HD variants.
- Implements strict CORS handling to control API access.
- Supports multi-day match aggregation (yesterday, today, tomorrow).
- Lightweight and easily deployable via Cloudflare Workers.

## Technologies Used

- Cloudflare Workers
- JavaScript (ES6+)
- Regular Expressions for JSONP parsing
- CORS policy enforcement

## API Response Format

Each API response returns an array of match objects. Example:

```json
{
  "match_time": "1715527200",
  "match_status": "live",
  "home_team_name": "Team A",
  "away_team_name": "Team B",
  "league_name": "Premier League",
  "match_score": "2 - 1",
  "servers": [
    {
      "name": "Soco SD",
      "stream_url": "https://cdn1.example/hls.m3u8",
      "referer": "https://socolivev.co/"
    },
    {
      "name": "Soco HD",
      "stream_url": "https://cdn1.example/hd.m3u8",
      "referer": "https://socolivev.co/"
    }
  ]
}
