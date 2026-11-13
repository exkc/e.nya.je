# msys
1 Install msys2

2 Open msys2

3 Run those command as below :

(See [here](https://stackoverflow.com/questions/53988638/git-fatal-protocol-https-is-not-supported) if you have issue on copy and paste.)

```
pacman -S  python git which

git clone https://github.com/exkc/e.nya.je.git

cd e.nya.je/getroot/offline

chmod +x setup.sh


```

4 Prass win + r 

5 Type cmd and click ok

![here](a.png)

6 Type ipconfig

![here](b.png)

as you can see the pc ip is 172.16.0.243

7 Click on the msys2 window and run


 ```

 ./setup.sh

 ```

8 Type the ip you got from `ifconfig` when it asked `What is the ip/local network domain of this device :`
