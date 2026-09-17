#!/bin/sh
cd "$(basename "$(dirname "$0")")/.." || exit

TELNETD_URL="${TELNETD_URL:-https://github.com/webosbrew/webos-homebrew-channel/raw/refs/heads/main/services/bin/telnetd}"
IPK_URL="${IPK_URL:-https://github.com/webosbrew/webos-homebrew-channel/releases/download/v0.7.3/org.webosbrew.hbchannel_0.7.3_all.ipk}"

download_hbc_ipk() {
    rm -f './wtfbro/payload/hbc.ipk'
    echo "Downloading Homebrew Channel IPK from ${IPK_URL}."
    if curl -L -o "./wtfbro/payload/hbc.ipk" -- "$IPK_URL"
    then
        echo "IPK downloaded successfully."
        return 0
    fi
    echo "Failed to download Homebrew Channel IPK"
    exit
}

download_telnetd() {
    rm -f './wtfbro/payload/telnetd'
    echo "Downloading telnetd from ${TELNETD_URL}."
    if curl -L -o "./wtfbro/payload/telnetd" -- "$TELNETD_URL"
    then
        echo "telnetd downloaded successfully."
        return 0
    fi
    echo "Failed to download telnetd"
    exit
}

askip(){
while true
do
echo 'What is the ip/local network domain of this device :'
read -r IP
if [ -z "$IP" ] || [ "$IP" = "0.0.0.0" ] || [ "$IP" = "127.0.0.1" ]
then
echo "Invild ip/local network domain.It shouldnt be empty/127.0.0.1/0.0.0.0"
else
echo 'const offlinemode=true;const offlinemodeip="'"$IP"'";' > config.js
break
fi
done
}

runserver() {
cat << QwQ
Open your tv browser
and go to http://${IP}/offlinemode.html
If u see QwQ on your tv 
then 
you can start to root your tv by fellow instruction as http://${IP}/
if u dont see QwQ on your tv
then 
check your firewall settings (make port 8080 is open)
maybe those link as below can help on checking your firewall setting :
https://github.com/termux-play-store/termux-apps/pull/116
https://developer.android.com/privacy-and-security/local-network-permission
https://ubuntuhandbook.org/index.php/2024/07/enable-disable-configure-firewall-ubuntu/
QwQ
if [ "$SERVER" = "php" ]
then
php -S 0.0.0.0:8080
elif [ "$SERVER" = "python3" ] 
then
python3 -m http.server 8080
fi
}

checkdep() {
if ! which curl > /dev/zero
then
echo "Curl not found Please install curl."
exit
fi
if which php > /dev/zero
then
SERVER="php"
elif which python3 > /dev/zero  
then
SERVER="python3"
fi

if [ -z "$SERVER" ]
then
echo "Supported http server not found.Please install php or python"
exit
fi

}

checkdep
askip
download_hbc_ipk
download_telnetd
runserver
