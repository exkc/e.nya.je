#!/bin/sh
cd "$(basename "$(dirname "$0")")/.." || exit

TELNETD_URL="${TELNETD_URL:-https://github.com/webosbrew/webos-homebrew-channel/raw/refs/heads/main/services/bin/telnetd}"
IPK_URL="${IPK_URL:-https://github.com/webosbrew/webos-homebrew-channel/releases/download/v0.7.3/org.webosbrew.hbchannel_0.7.3_all.ipk}"

download_hbc_ipk() {
	
    if [ -e "./wtfbro/payload/hbc.ipk" ]
    then
    echo "Homebrew Channel IPK Found.Skiping Downloading..."
    return 0
    fi

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
    
    if [ -e "./wtfbro/payload/telnetd" ]
    then
    echo "telnetd Found.Skiping Downloading..."
    return 0
    fi

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
echo '{"offlinemode":true,"offlinemodeip":"'"$IP"'"}'  > config.json
break
fi
done
}

runserver() {
cat << QwQ
Open the browser on the tv or another device
(if you get stuck in the t&s screen when u try to open the browser on the tv 
then use another device.)
then go to http://${IP}:8080/offlinemode.html in the browser
If u see QwQ in the browser
then 
you can start to root your tv by fellow instruction as http://${IP}:8080/
if u dont see QwQ in the browser
then 
check your firewall settings (make sure port 8080 is opened)
maybe those link as below can help on firewall settings :
https://github.com/termux-play-store/termux-apps/pull/116
https://developer.android.com/privacy-and-security/local-network-permission
https://ubuntuhandbook.org/index.php/2024/07/enable-disable-configure-firewall-ubuntu/
QwQ
if [ "$SERVER" = "python3" ] 
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
if which python3 > /dev/zero  
then
SERVER="python3"
fi

if [ -z "$SERVER" ]
then
echo "Supported http server not found.Please install python"
exit
fi

}

checkdep
askip
download_hbc_ipk
download_telnetd
runserver
