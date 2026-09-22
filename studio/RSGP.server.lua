-- RSGP Studio Bridge v0.1. Install as a Studio plugin, not an in-game Script.
-- Pair via the website; poll only approved, allowlisted mutations. No local server or Rojo.
local HttpService=game:GetService("HttpService")
local RunService=game:GetService("RunService")
local ChangeHistoryService=game:GetService("ChangeHistoryService")
local Workspace=game:GetService("Workspace")
local toolbar=plugin:CreateToolbar("RSGP")
local toggle=toolbar:CreateButton("Open RSGP","Connect Studio to your RSGP workspace","")
local info=DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right,true,false,350,400,300,300)
local widget=plugin:CreateDockWidgetPluginGui("RSGPBridge",info)
widget.Title="RSGP Studio Bridge"
local root=Instance.new("Frame")
root.Size=UDim2.fromScale(1,1)
root.BackgroundColor3=Color3.fromRGB(20,20,31)
root.Parent=widget
local layout=Instance.new("UIListLayout")
layout.Padding=UDim.new(0,9)
layout.Parent=root
local function textBox(placeholder,initial)
 local box=Instance.new("TextBox")
 box.Size=UDim2.new(1,-20,0,36)
 box.BackgroundColor3=Color3.fromRGB(38,37,55)
 box.TextColor3=Color3.new(1,1,1)
 box.PlaceholderColor3=Color3.fromRGB(170,160,194)
 box.PlaceholderText=placeholder
 box.Text=initial or ""
 box.ClearTextOnFocus=false
 box.Parent=root
 return box
end
local function button(label)
 local btn=Instance.new("TextButton")
 btn.Size=UDim2.new(1,-20,0,36)
 btn.BackgroundColor3=Color3.fromRGB(110,79,207)
 btn.TextColor3=Color3.new(1,1,1)
 btn.Text=label
 btn.Parent=root
 return btn
end
local title=Instance.new("TextLabel")
title.Size=UDim2.new(1,-20,0,48)
title.BackgroundTransparency=1
title.TextColor3=Color3.new(1,1,1)
title.Text="RSGP  |  Game Printer"
title.TextSize=21
title.Parent=root
local urlField=textBox("RSGP HTTPS website URL",plugin:GetSetting("RSGPUrl") or "")
local codeField=textBox("One-time pairing code","")
local connectBtn=button("Connect to project")
local stopBtn=button("Pause / Disconnect")
local status=Instance.new("TextLabel")
status.Size=UDim2.new(1,-20,0,76)
status.TextWrapped=true
status.BackgroundTransparency=1
status.TextColor3=Color3.fromRGB(187,177,216)
status.Text="Pair from your RSGP project page."
status.Parent=root
local token=nil
local origin=nil
local running=false
local function setStatus(message) status.Text=message end
local function request(method,path,body)
 local headers={["Content-Type"]="application/json"}
 if token then headers.Authorization="Bearer "..token end
 local ok,result=pcall(function()
  return HttpService:RequestAsync({Url=origin..path,Method=method,Headers=headers,Body=body and HttpService:JSONEncode(body) or nil})
 end)
 if not ok then error("Network failure: "..tostring(result)) end
 local data=HttpService:JSONDecode(result.Body)
 if not result.Success then error(tostring(data.error or ("HTTP "..tostring(result.StatusCode)))) end
 return data
end
local function number3(values,minimum,maximum)
 if type(values)~="table" or #values~=3 then error("Invalid vector") end
 for i=1,3 do
  if type(values[i])~="number" or values[i]<minimum or values[i]>maximum then error("Vector out of range") end
 end
 return Vector3.new(values[1],values[2],values[3])
end
local function safeName(value)
 if type(value)~="string" or #value<1 or #value>80 or not string.match(value,"^[%w _%-]+$") then error("Invalid name") end
 return value
end
local function createPart(p)
 local position=number3(p.position,-2048,2048)
 local size=number3(p.size,.1,256)
 local color=number3(p.color,0,255)
 local part=Instance.new("Part")
 part.Name=safeName(p.name)
 part.Anchored=true
 part.Size=size
 part.Position=position
 part.Color=Color3.fromRGB(color.X,color.Y,color.Z)
 part.Parent=Workspace
 return part:GetFullName()
end
local function createScript(p)
 local parents={
  ServerScriptService=game:GetService("ServerScriptService"),
  ReplicatedStorage=game:GetService("ReplicatedStorage"),
  StarterPlayerScripts=game:GetService("StarterPlayer"):WaitForChild("StarterPlayerScripts"),
 }
 local classes={Script=true,ModuleScript=true,LocalScript=true}
 if not parents[p.parent] or not classes[p.className] or type(p.source)~="string" or #p.source>16000 or #p.source<1 then error("Invalid script parameters") end
 if (p.className=="Script" and p.parent~="ServerScriptService") or (p.className=="ModuleScript" and p.parent~="ReplicatedStorage") or (p.className=="LocalScript" and p.parent~="StarterPlayerScripts") then error("Invalid script location") end
 local scriptObj=Instance.new(p.className)
 scriptObj.Name=safeName(p.name)
 -- ModuleScripts cannot be disabled; they do not execute until explicitly required.
 if p.className~="ModuleScript" then scriptObj.Disabled=true end
 scriptObj.Source=p.source
 scriptObj.Parent=parents[p.parent]
 return scriptObj:GetFullName().." (review required before use)"
end
local function createGui(p)
 local color=number3(p.color,0,255)
 local gui=Instance.new("ScreenGui")
 gui.Name=safeName(p.name)
 gui.ResetOnSpawn=false
 local frame=Instance.new("Frame")
 frame.Size=UDim2.fromOffset(340,75)
 frame.Position=UDim2.new(.5,-170,0,24)
 frame.BackgroundColor3=Color3.fromRGB(color.X,color.Y,color.Z)
 frame.Parent=gui
 local corner=Instance.new("UICorner")
 corner.CornerRadius=UDim.new(0,12)
 corner.Parent=frame
 local heading=Instance.new("TextLabel")
 heading.Size=UDim2.fromScale(1,1)
 heading.Text=string.sub(tostring(p.title or ""),1,100)
 heading.TextScaled=true
 heading.TextColor3=Color3.new(1,1,1)
 heading.BackgroundTransparency=1
 heading.Parent=frame
 gui.Parent=game:GetService("StarterGui")
 return gui:GetFullName()
end
local handlers={create_part=createPart,create_script=createScript,create_gui=createGui}
local function process(command)
 local worked,result=pcall(function()
  if not RunService:IsEdit() then error("Stop playtest before applying changes") end
  if type(command.payload)~="table" or not handlers[command.kind] then error("Unsupported command") end
  ChangeHistoryService:SetWaypoint("Before RSGP "..command.kind)
  local path=handlers[command.kind](command.payload)
  ChangeHistoryService:SetWaypoint("After RSGP "..command.kind)
  return path
 end)
 local delivered,err=pcall(function()
  request("POST","/api/plugin/result",{commandId=command.id,success=worked,detail=string.sub(tostring(result),1,800)})
 end)
 if not delivered then setStatus("Result delivery failed; reconcile before repeating: "..tostring(err))
 else setStatus((worked and "Applied: " or "Failed: ")..tostring(result)) end
end
connectBtn.MouseButton1Click:Connect(function()
 if running then setStatus("Already connected; pause before reconnecting.") return end
 local candidate=urlField.Text:gsub("/+$","")
 if not candidate:match("^https://[%w%.-]+$") then setStatus("Enter a valid HTTPS website origin, without a path.") return end
 origin=candidate
 token=nil
 local code=codeField.Text:lower():gsub("%s+","")
 if not code:match("^[0-9a-f]+$") or #code~=24 then setStatus("Enter the 24-character pairing code.") return end
 local ok,data=pcall(function()
  return request("POST","/api/plugin/claim",{code=code,studioId=tostring(game.PlaceId)..":"..tostring(game.GameId),label=game.Name})
 end)
 if not ok then setStatus("Pairing failed: "..tostring(data)) return end
 token=data.token
 plugin:SetSetting("RSGPUrl",origin)
 codeField.Text=""
 running=true
 setStatus("Connected. Waiting for approved commands...")
 task.spawn(function()
  while running and token do
   local success,payload=pcall(function() return request("GET","/api/plugin/next") end)
   if success and payload.command then process(payload.command)
   elseif not success then setStatus("Connection error: "..tostring(payload)); running=false; token=nil; break end
   task.wait(3)
  end
 end)
end)
stopBtn.MouseButton1Click:Connect(function()
 running=false
 token=nil
 setStatus("Paused. Revoke the connection on the website; pair again to reconnect.")
end)
toggle.Click:Connect(function() widget.Enabled=not widget.Enabled end)
