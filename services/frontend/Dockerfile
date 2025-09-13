FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"] //TODO: separate dev server, for prod only serve static files