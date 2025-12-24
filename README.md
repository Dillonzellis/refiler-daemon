create config.json and generate key

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

\*\* Check endpoints
curl http://127.0.0.1:18427/health
curl -H "X-Refiler-Token: <YOUR_TOKEN>" http://127.0.0.1:18427/status
