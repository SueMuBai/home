# Include inside met.1692958.xyz's actual HTTP/HTTPS server blocks.
# Only a credential-free client page is proxied. Tickets stay in URL fragments;
# the browser redeems them directly at Home with exact CORS origin/IP/session checks.
location = /.home-login {
    set $home_login_transport "$scheme:$http_x_forwarded_proto";
    if ($home_login_transport !~ "^(https:|http:https$)") { return 308 https://$host$request_uri; }
    if ($request_method != GET) { return 405; }
    proxy_pass https://subaimu.com/_home_login/client;
    proxy_ssl_server_name on;
    proxy_ssl_name subaimu.com;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_set_header Host subaimu.com;
    proxy_set_header Cookie "";
    proxy_set_header Authorization "";
    proxy_set_header Accept-Encoding "";
    proxy_cache off;
    access_log off;
}
