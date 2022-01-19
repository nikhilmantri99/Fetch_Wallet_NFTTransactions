import Moralis from "moralis/node.js";
import fetch from 'node-fetch';
const serverUrl = "https://kpvcez1i2tg3.usemoralis.com:2053/server";
const appId = "viZCI1CZimCj22ZTyFuXudn3g0wUnG2pELzPvdg6";
Moralis.start({ serverUrl, appId });

async function covalent_logs(txn_hash,waddress,NFTfrom,NFTto){
    let part1='https://api.covalenthq.com/v1/1/transaction_v2/';
    let part2=txn_hash;
    let part3='/?&key=';
    let part4='ckey_c4b9331412914d59845089270d';
    let url_complete=part1.concat(part2,part3,part4);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    var mainmoney=0,comission=0,i=0;
    if(ans.data!=null && ans.data.items!=null){
        for(i=0;i<ans.data.items[0].log_events.length;i++){
            if(ans.data.items[0].log_events[i].sender_contract_ticker_symbol=="ENS"){
                return [-1];
            }
        }
    }
    if(ans.data!=null && ans.data.items!=null){
        for(i=0;i<ans.data.items[0].log_events.length;i++){
            if( ans.data.items[0].log_events[i].decoded!=null 
                && ans.data.items[0].log_events[i].sender_contract_decimals==18
                && ans.data.items[0].log_events[i].decoded.name=="Transfer"
                && ans.data.items[0].log_events[i].decoded.params!=null 
                && ans.data.items[0].log_events[i].decoded.params[2].value!=null){
                if(ans.data.items[0].log_events[i].decoded.params[1].value==NFTfrom){
                    mainmoney+=parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                    if(i+1<ans.data.items[0].log_events.length){
                        if(ans.data.items[0].log_events[i+1].decoded!=null 
                            && ans.data.items[0].log_events[i+1].sender_contract_decimals==18
                            && ans.data.items[0].log_events[i+1].decoded.name=="Transfer"
                            && ans.data.items[0].log_events[i+1].decoded.params[2].value!=null){
                                comission+=parseInt(ans.data.items[0].log_events[i+1].decoded.params[2].value)/(10**18);
                        }
                    }
                    //return [mainmoney,comission];
                }
                else if(ans.data.items[0].log_events[i].decoded.params[0].value==NFTfrom){
                    mainmoney-=parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                    comission+=parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                }
            }
        }
    }
    if(mainmoney==0 && comission==0) return null;
    else return [mainmoney,comission];
}

async function etherscan_logs(txn_hash,waddress,NFTfrom,NFTto){
    let part1= 'https://api.etherscan.io/api?module=account&action=txlistinternal&txhash=';
    let part2=txn_hash;
    let part3='&apikey=';
    let part4='3K72Z6I2T121TAQZ9DY34EF6F9NADKAH87';
    let url_complete=part1.concat(part2,part3,part4);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    var mainmoney=0,commission=0;
    
    for(var i=0;i<ans.result.length;i++){
        if(ans.result[i].value!=null){
            if(ans.result[i].to==NFTfrom){
                mainmoney+=parseInt(ans.result[i].value)/(10**18);
                if(i-1>=0){
                    commission+=parseInt(ans.result[i-1].value)/(10**18);
                }
                //return [mainmoney,commission];
            }
            else if(ans.result[i].from==NFTfrom){
                mainmoney-=parseInt(ans.result[i].value)/(10**18);
                commission+=parseInt(ans.result[i].value)/(10**18);
            }
        }
    }
    if(mainmoney==0 && commission==0){
        return null;
    }
    else{
        return [mainmoney,commission];
    }
}

async function value_from_hash(txn_hash,waddress,NFTfrom,NFTto){
    const ans1= await covalent_logs(txn_hash,waddress,NFTfrom,NFTto);
    //const ans2= await etherscan_logs(txn_hash,waddress);
    //console.log(ans1);
    //console.log(ans2);
    if(ans1==[-1]){
        return -1;
    }
    if(ans1==null){
        const ans2= await etherscan_logs(txn_hash,waddress,NFTfrom,NFTto);
        return ans2;
    }
    else{
        return ans1;
    }
}

const chain_name="eth";
//const waddress="0x4958cde93218e9bbeaa922cd9f8b3feec1342772";
//const waddress="0x899241b0c41051313ce36271a7e13d54c94877a1";
const waddress="0xe8bf704e1e27067c664177a851166021e96c1071";
const options = { chain: chain_name, address: waddress,limit:"30"};
const transfersNFT = await Moralis.Web3API.account.getNFTTransfers(options);
console.log(transfersNFT);
console.log("For wallet address:",waddress," ,chain: ",chain_name,"\nFollowing are the NFT Transaction values: ")
var count=0;
for(var i=0;i<transfersNFT.result.length;i++){
    //console.log("Hello");
    const value_from_moralis=parseInt(transfersNFT.result[i].value)/(10**18);
    //console.log(transfersNFT.result[i].transaction_hash);
    const value_from_hash_scans=await value_from_hash(transfersNFT.result[i].transaction_hash,waddress,
                                                        transfersNFT.result[i].from_address,transfersNFT.result[i].to_address);
    if(value_from_hash_scans==-1){
        continue;
    }
    //console.log(value_from_moralis,value_from_hash_scans);
    var final_value;
    if(value_from_hash_scans!=null){
        final_value=value_from_hash_scans;
        if(final_value[0]<0){
            final_value[0]+=value_from_moralis;
        }
    }
    else{
        final_value=[value_from_moralis,0];
    }
    count++;
    if(transfersNFT.result[i].from_address==waddress){
        console.log(count,". Sold NFT. Revenue Increases. Value:",final_value[0]," Hash: ",transfersNFT.result[i].transaction_hash);
    }
    else{
        console.log(count,". Bought NFT. Spending Increases. Value:",final_value[0]+final_value[1]," Hash: ",transfersNFT.result[i].transaction_hash);
    }
    console.log("NFT went from: ",transfersNFT.result[i].from_address," to: ",transfersNFT.result[i].to_address);
}
// console.log(transfersNFT);
// NFTtransfersFromWallet(chain_,address_);



