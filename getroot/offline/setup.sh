#!/bin/sh
cd "$(realpath "$(dirname "$0")")/.." || exit

TELNETD_URL="${TELNETD_URL:-https://github.com/webosbrew/webos-homebrew-channel/raw/refs/heads/main/services/bin/telnetd}"
IPK_URL="${IPK_URL:-https://github.com/webosbrew/webos-homebrew-channel/releases/download/v0.7.3/org.webosbrew.hbchannel_0.7.3_all.ipk}"
YN=""

download() {
    
    if [ -e "./wtfbro/payload/$1" ]
    then
    echo "$2 Found.Skiping Downloading..."
    return 0
    fi

    if [ -z "$YN" ]
    then
   while true
   do
   echo 'Would you like to download some necessary file now? (y/n/yes/no) :'
   #get rid of unknown operand msg
   YN="QwQ"
   read -r YN
if [ "$YN" = "y" ] || [ "$YN" = "yes" ]
then
break
elif [ "$YN" = "n" ] || [ "$YN" = "no" ]
then
cat << QwQ
u may rerun this script for downloading those missing file.
Also this script require internet to download necessary file.
u can run it offline after those file is downloaded 
the script would exit due to missing files.
QwQ
exit
fi
done
    fi

    echo "Downloading $2 from ${3}."
    if curl -L -o "./wtfbro/payload/$1" -- "$3"
    then
        echo "$2 downloaded successfully."
        return 0
    fi
    echo "Failed to download ${2}."
    exit
}

askip(){
while true
do
echo 'What is the ip/local network domain of this device :'
read -r IP
if [ -z "$IP" ] || [ "$IP" = "0.0.0.0" ] || [ "$IP" = "127.0.0.1" ]
then
echo "Invalid ip/local network domain.It shouldnt be empty/127.0.0.1/0.0.0.0"
else
echo '{"offlinemode":true,"offlinemodeip":"'"$IP"':8080"}'  > offline.json
break
fi
done
}

runserver() {
cat << QwQ
Open the browser on the tv
Then go to http://${IP}:8080/offlinemode.html in the browser
you should see QwQ in browser.
if u dont see QwQ in the browser
then 
check your firewall configuration (make sure port 8080 is opened)
maybe those link as below can help on firewall configuration :
https://github.com/termux-play-store/termux-apps/pull/116
https://developer.android.com/privacy-and-security/local-network-permission
https://ubuntuhandbook.org/index.php/2024/07/enable-disable-configure-firewall-ubuntu/
(The step in above is for testing this device's firewall 
if you get stuck in the t&s screen 
when u try to open the browser on the tv 
then u may use use another device in your network for doing this step
However in wifi p2p newtwork 
you have to use the tv to test this device's firewall.
If you know your firewall is configed properly 
then u may skip the step.)

If your firewall is configed properly
then 
you can start to root your tv by fellow instruction as http://${IP}:8080/
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
download "hbc.ipk" "Homebrew Channel IPK" "$IPK_URL"
download "telnetd" "telnetd" "$TELNETD_URL"
askip
runserver
