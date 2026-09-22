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
local boundStudioId=nil
local function currentStudioId() return tostring(game.PlaceId)..":"..tostring(game.GameId) end
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
 local elements=p.elements or {}
 if type(elements)~="table" or #elements>8 then error("Invalid GUI elements") end
 for _,entry in ipairs(elements) do
  if type(entry)~="table" or (entry.kind~="label" and entry.kind~="button") or type(entry.text)~="string" or #entry.text<1 or #entry.text>80 then
   error("Invalid GUI element")
  end
 end
 local gui=Instance.new("ScreenGui")
 gui.Name=safeName(p.name)
 gui.ResetOnSpawn=false
 local frame=Instance.new("Frame")
 frame.Name="Panel"
 frame.AnchorPoint=Vector2.new(.5,0)
 frame.Size=UDim2.new(.9,0,0,65+(#elements*44))
 frame.Position=UDim2.new(.5,0,0,24)
 frame.BackgroundColor3=Color3.fromRGB(color.X,color.Y,color.Z)
 frame.Parent=gui
 local maxWidth=Instance.new("UISizeConstraint")
 maxWidth.MaxSize=Vector2.new(400,440)
 maxWidth.Parent=frame
 local corner=Instance.new("UICorner")
 corner.CornerRadius=UDim.new(0,12)
 corner.Parent=frame
 local pad=Instance.new("UIPadding")
 pad.PaddingTop=UDim.new(0,8)
 pad.PaddingLeft=UDim.new(0,10)
 pad.PaddingRight=UDim.new(0,10)
 pad.Parent=frame
 local layout=Instance.new("UIListLayout")
 layout.Padding=UDim.new(0,6)
 layout.FillDirection=Enum.FillDirection.Vertical
 layout.Parent=frame
 local heading=Instance.new("TextLabel")
 heading.Name="Heading"
 heading.Size=UDim2.new(1,0,0,43)
 heading.Text=string.sub(tostring(p.title or ""),1,100)
 heading.TextScaled=true
 heading.TextColor3=Color3.new(1,1,1)
 heading.BackgroundTransparency=1
 heading.LayoutOrder=0
 heading.Parent=frame
 for index,entry in ipairs(elements) do
  local child=Instance.new(entry.kind=="button" and "TextButton" or "TextLabel")
  child.Name=string.format("Element%02d",index)
  child.Size=UDim2.new(1,0,0,36)
  child.LayoutOrder=index
  child.Text=entry.text
  child.TextColor3=Color3.new(1,1,1)
  child.TextScaled=true
  child.TextWrapped=true
  child.BackgroundTransparency=entry.kind=="button" and 0 or 1
  child.BackgroundColor3=Color3.fromRGB(35,33,52)
  if entry.kind=="button" then
   -- UI is a visual prototype; no behavior is attached until reviewed Luau is wired.
   child.Active=false
   child.AutoButtonColor=false
   local childCorner=Instance.new("UICorner")
   childCorner.CornerRadius=UDim.new(0,8)
   childCorner.Parent=child
  end
  child.Parent=frame
 end
 gui.Parent=game:GetService("StarterGui")
 return gui:GetFullName().." (visual layout; buttons are not wired)"
end
local function installImage(p)
 local assetId=p.robloxAssetId
 if type(assetId)~="string" or not assetId:match("^[1-9]%d*$") or #assetId>20 then error("Invalid Roblox image ID") end
 if type(p.kind)~="string" or not ({icon=true,thumbnail=true,texture=true,gui=true})[p.kind] then error("Invalid image type") end
 local gui=Instance.new("ScreenGui")
 gui.Name=safeName(p.name)
 gui.ResetOnSpawn=false
 gui:SetAttribute("RSGPAssetId",tostring(p.assetId or ""))
 gui:SetAttribute("RSGPAssetType",p.kind)
 local image=Instance.new("ImageLabel")
 image.Name="ImagePreview"
 image.AnchorPoint=Vector2.new(.5,.5)
 image.Position=UDim2.fromScale(.5,.5)
 image.Size=UDim2.new(.8,0,.6,0)
 image.BackgroundTransparency=1
 image.ScaleType=Enum.ScaleType.Fit
 image.Image="rbxassetid://"..assetId
 local sizeLimit=Instance.new("UISizeConstraint")
 sizeLimit.MaxSize=Vector2.new(650,420)
 sizeLimit.Parent=image
 image.Parent=gui
 gui.Parent=game:GetService("StarterGui")
 return gui:GetFullName().." (Image property assigned; moderation, accessibility and rendering NOT verified)"
end
local handlers={create_part=createPart,create_script=createScript,create_gui=createGui,install_image=installImage}
local function process(command)
 local worked,result=pcall(function()
  if not RunService:IsEdit() then error("Stop playtest before applying changes") end
  if boundStudioId~=currentStudioId() then error("The connected Studio place changed; pair again") end
  if type(command.payload)~="table" or not handlers[command.kind] then error("Unsupported command") end
  ChangeHistoryService:SetWaypoint("Before RSGP "..command.kind)
  local path=handlers[command.kind](command.payload)
  ChangeHistoryService:SetWaypoint("After RSGP "..command.kind)
  return path
 end)
 local delivered,err=pcall(function()
  request("POST","/api/plugin/result",{commandId=command.id,leaseId=command.leaseId,success=worked,detail=string.sub(tostring(result),1,800)})
 end)
 if not delivered then
  setStatus("Result delivery uncertain. Inspect Studio and reconcile on the site: "..tostring(err))
  running=false
  token=nil
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
  return request("POST","/api/plugin/claim",{code=code,studioId=currentStudioId(),label=game.Name})
 end)
 if not ok then setStatus("Pairing failed: "..tostring(data)) return end
 token=data.token
 boundStudioId=currentStudioId()
 plugin:SetSetting("RSGPUrl",origin)
 codeField.Text=""
 running=true
 setStatus("Connected. Waiting for approved commands...")
 task.spawn(function()
  while running and token do
   if boundStudioId~=currentStudioId() then setStatus("Studio place changed; reconnect."); running=false; token=nil; break end
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
