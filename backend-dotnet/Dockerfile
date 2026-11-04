# Build from the repo root, since the image also needs backend/db/schema.sql:
#   docker build -f backend-dotnet/Dockerfile -t vizo-api-dotnet .

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/db/schema.sql backend/db/schema.sql
COPY backend-dotnet/src/Vizo.Api/Vizo.Api.csproj backend-dotnet/src/Vizo.Api/
RUN dotnet restore backend-dotnet/src/Vizo.Api/Vizo.Api.csproj
COPY backend-dotnet/src/Vizo.Api/ backend-dotnet/src/Vizo.Api/
RUN dotnet publish backend-dotnet/src/Vizo.Api/Vizo.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production \
    PORT=4000
EXPOSE 4000
USER $APP_UID
ENTRYPOINT ["dotnet", "Vizo.Api.dll"]
