const scale = {$SCALE};
const temperature = Number(value) / scale;
Zabbix.log(4, 'Scaled temperature: ' + temperature);
return temperature;
