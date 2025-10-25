FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

# Make entrypoint script executable
RUN chmod +x /usr/src/app/entrypoint.sh

EXPOSE 4200

# Use entrypoint to inject env vars at runtime
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["npm", "start"]