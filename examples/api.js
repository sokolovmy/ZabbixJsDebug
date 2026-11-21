var params = JSON.parse(value);
var request = new HttpRequest();
var body = request.get(params.url);
Zabbix.log(4, 'HTTP status: ' + request.getStatus());
return body;
