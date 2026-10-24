Quick diagnosis, if you can get a terminal (keyboard usually still works even when the trackpad doesn't):                                                                                                                          
dmesg | grep -iE 'applespi|spi_pxa|intel_lpss'                                                                                                                                                                                     
lsmod | grep -iE 'applespi|spi_pxa|intel_lpss'

Try loading it manually:                                                                                                                                                                                                           
sudo modprobe intel_lpss_pci                                                                                                                                                                                                       
sudo modprobe spi_pxa2xx_platform                                                                                                                                                                                                  
sudo modprobe applespi                                                                                                                                                                                                             
If that makes the trackpad start working, the fix is just ensuring those three load automatically (e.g. add them to /etc/modules in the image).            





1. Reboot the Mac, get into the boot picker again (Option key), boot the USB.
2. At the GRUB menu, highlight the boot entry and press e to edit it before booting.
3. Find the linux line — it'll end in boot=live components quiet splash. Append init=/bin/bash to the end of that line.
4. Boot (Ctrl+X or F10).

This drops you straight into a root shell inside the full live filesystem (no login, no password needed — init= bypasses that entirely) — this exact technique is what was used earlier to debug this same image (documented in kiosk-image/README.md).

One thing to know once you're in that shell: since it skips normal init entirely, /proc, /sys, and /dev aren't mounted yet, and networking isn't up. Run this first:
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev
Then for WiFi: dmesg | grep -iE 'wifi|wlan|brcm|iwlwifi', ip link, rfkill list. For audio: aplay -l, dmesg | grep -iE 'audio|hda|snd'.