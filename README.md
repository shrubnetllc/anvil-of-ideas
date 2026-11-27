# Anvil of Ideas

The React dashboard helps founders develop ideas into Lean Canvases, requirements documents, workflow specifications and estimates. The browser calls the dashboard endpoints in `shrubnetllc/anvil-api`. FastAPI manages sessions and stores project data in PostgreSQL. Its RabbitMQ worker runs document generation through Hermes Agent.

## Local development

Use Node.js 22 and start the FastAPI dashboard service (`app.dashboard.main:app`) using the instructions in the companion repository. [Backend setup](https://github.com/shrubnetllc/anvil-api/blob/main/dashboard.md)

```sh
npm ci
npm run dev
```

Open http://localhost:5000. Vite forwards dashboard requests and email verification links to http://127.0.0.1:8000. To use another backend, set the `FASTAPI_ORIGIN` environment variable in the shell that starts Vite.

## Production

The Dockerfile builds the React app and serves it with Caddy. Set `FASTAPI_ORIGIN` to the FastAPI service origin reachable from the frontend container. The image defaults to `http://backend:8000` and listens on port 5000. Configure the backend's public frontend URL to match the origin users open in their browser so email verification links work.

```sh
docker build -t anvil-dashboard .
docker run --network anvil -p 5000:5000 -e FASTAPI_ORIGIN=http://backend:8000 anvil-dashboard
```

The example assumes the dashboard and backend share a Docker network named `anvil`. For a deployment outside Docker, run `npm ci && npm run build`, install Caddy 2, then run `npm start` from the project root. Caddy serves the assets from `dist/public` and proxies dashboard requests on the same origin so the browser can send its session cookie. Set `PORT` to change its listening port.

Set `VITE_ULTIMATE_WEBSITE_GENERATOR_URL` at build time to enable links to your website generator. The database connection, model provider credentials and Hermes gateway settings belong on the backend.

## License

MIT. See [LICENSE](LICENSE).
