{
  config,
  ...
}:
{
  services.nginx.enable = true;
  services.nginx.httpConfig = ''
    keepalive_timeout  65;

    server {
        listen       8080;
        server_name  localhost;

        root ${config.devenv.root};
    }
  '';
}

