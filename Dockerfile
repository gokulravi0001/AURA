FROM node:20-alpine

WORKDIR /app

# Copy root dependencies and install
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose API and WebSocket port
EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "index.js"]
