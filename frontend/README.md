### Build Docker Image
```bash
docker build -t frontend .
```

### Run Container
```bash
docker run -p 4200:4200 frontend
```

The application will be available at `http://localhost:4200`